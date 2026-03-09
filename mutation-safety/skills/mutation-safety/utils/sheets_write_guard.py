"""SheetsWriteGuard - Safety System for Destructive Google Sheets Operations

Enforces two-step approval for destructive Google Sheets operations:
- Clearing entire sheets/tabs
- Overwriting existing data
- Deleting rows/columns in bulk
- Batch updates that replace content

This guard does NOT trigger for:
- Appending new rows to empty space
- Reading operations
- Creating new sheets/tabs
- Single cell updates

Usage:
    from utils.sheets_write_guard import SheetsWriteGuard, SheetsWriteRequest

    request = SheetsWriteRequest(
        operation_type="CLEAR_SHEET",
        spreadsheet_id="1abc123...",
        spreadsheet_name="My Report",
        sheet_name="Data Tab",
        description="Clear all data before refresh",
        dry_run_preview={
            "rows_affected": 500,
            "columns_affected": 10,
            "sample_data": ["Row 1 preview", "Row 2 preview"]
        }
    )

    guard = SheetsWriteGuard()
    result = guard.execute(request, clear_sheet_func)
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class SheetsWriteState(Enum):
    """State machine for sheets write approval flow"""
    INITIAL = "initial"
    PREVIEW_GENERATED = "preview_generated"
    UNLOCKED = "unlocked"
    EXECUTING = "executing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Operation types that require approval
DESTRUCTIVE_OPERATIONS = {
    "CLEAR_SHEET",      # Clear entire sheet
    "CLEAR_RANGE",      # Clear a range of cells
    "OVERWRITE_DATA",   # Replace existing data
    "DELETE_ROWS",      # Delete multiple rows
    "DELETE_COLUMNS",   # Delete multiple columns
    "BATCH_UPDATE",     # Batch updates that modify existing data
    "DELETE_SHEET",     # Delete entire sheet/tab
}

# Operations that are safe (no approval needed)
SAFE_OPERATIONS = {
    "APPEND_ROWS",      # Add new rows to end
    "CREATE_SHEET",     # Create new sheet/tab
    "READ_DATA",        # Reading operations
    "FORMAT_CELLS",     # Formatting only
}


@dataclass
class SheetsWriteRequest:
    """Represents a request to write destructively to Google Sheets"""
    operation_type: str  # CLEAR_SHEET, OVERWRITE_DATA, DELETE_ROWS, etc.
    spreadsheet_id: str  # Google Sheets ID
    spreadsheet_name: str  # Human-readable name
    sheet_name: str  # Tab/sheet name
    description: str  # What this operation does
    dry_run_preview: Dict[str, Any]  # Preview data to show user

    # Optional range info
    range_notation: str = None  # e.g., "A1:Z100"

    # Metadata
    requested_by: str = "user"
    requested_at: datetime = None

    def __post_init__(self):
        if self.requested_at is None:
            self.requested_at = datetime.now()


def generate_sheets_approval_code() -> str:
    """Generate a unique approval code for sheets operations"""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"SHEETS-{timestamp}"


class SheetsWriteSession:
    """Tracks state for a single sheets write session"""

    def __init__(self, request: SheetsWriteRequest, session_file: Optional[Path] = None):
        self.request = request
        self.state = SheetsWriteState.INITIAL
        self.approval_code = None
        self.unlocked_at = None
        self.executed_at = None
        self.timeout_minutes = 10
        self.session_file = session_file

    def generate_preview(self) -> str:
        """Generate approval code and preview output"""
        self.approval_code = generate_sheets_approval_code()
        self.state = SheetsWriteState.PREVIEW_GENERATED
        self._save_to_file()
        return self._format_preview()

    def _format_preview(self) -> str:
        """Format dry-run preview for user"""
        lines = []
        lines.append("=" * 80)
        lines.append("SHEETS DRY-RUN PREVIEW - NO CHANGES WILL BE MADE")
        lines.append("=" * 80)
        lines.append(f"\nOperation: {self.request.operation_type}")
        lines.append(f"Spreadsheet: {self.request.spreadsheet_name}")
        lines.append(f"Sheet/Tab: {self.request.sheet_name}")
        if self.request.range_notation:
            lines.append(f"Range: {self.request.range_notation}")
        lines.append(f"Description: {self.request.description}")
        lines.append("\nPreview Details:")

        for key, value in self.request.dry_run_preview.items():
            if isinstance(value, list) and len(value) > 5:
                lines.append(f"  {key}: {value[:5]}... ({len(value)} total)")
            else:
                lines.append(f"  {key}: {value}")

        lines.append("\n" + "=" * 80)
        lines.append("WARNING: This operation will modify/delete existing data!")
        lines.append("=" * 80)
        lines.append("\nTo proceed, respond with:")
        lines.append(f'  "I approve {self.approval_code}, unlock and ready to post"')
        lines.append("\n(Or say 'cancel' to abort)")
        lines.append("=" * 80)

        return "\n".join(lines)

    def verify_unlock(self, user_message: str) -> tuple[bool, str]:
        """Verify user provided correct approval code"""
        if self.state != SheetsWriteState.PREVIEW_GENERATED:
            return (False, "Cannot unlock: No preview has been generated yet")

        if "cancel" in user_message.lower():
            self.state = SheetsWriteState.CANCELLED
            return (False, "Sheets operation cancelled by user")

        if self._is_timed_out():
            self.state = SheetsWriteState.INITIAL
            return (False, "Session timed out. Please re-run to generate new approval code.")

        if self.approval_code not in user_message:
            return (False, f"Approval code not found. Please include: {self.approval_code}")

        if "unlock and ready to post" not in user_message.lower():
            return (False, "Unlock phrase not found. Please say: 'unlock and ready to post'")

        self.state = SheetsWriteState.UNLOCKED
        self.unlocked_at = datetime.now()
        self._save_to_file()

        lines = []
        lines.append("=" * 80)
        lines.append("SHEETS APPROVAL VERIFIED")
        lines.append("=" * 80)
        lines.append(f"Approval Code: {self.approval_code}")
        lines.append(f"Operation: {self.request.operation_type}")
        lines.append(f"Target: {self.request.spreadsheet_name} > {self.request.sheet_name}")
        lines.append("\nReady to execute.")
        lines.append("\nTo execute now, respond with: POST NOW")
        lines.append("(Or say 'cancel' to abort)")
        lines.append("=" * 80)

        return (True, "\n".join(lines))

    def verify_post_command(self, user_message: str) -> tuple[bool, str]:
        """Verify user said 'POST NOW' to execute"""
        if self.state != SheetsWriteState.UNLOCKED:
            return (False, "Cannot post: Session not unlocked.")

        if "cancel" in user_message.lower():
            self.state = SheetsWriteState.CANCELLED
            return (False, "Sheets operation cancelled by user")

        if self._is_timed_out():
            self.state = SheetsWriteState.INITIAL
            return (False, "Session timed out. Please re-run to generate new approval code.")

        if "post now" not in user_message.lower():
            return (False, "To execute, you must say: POST NOW")

        self.state = SheetsWriteState.EXECUTING
        self.executed_at = datetime.now()

        return (True, "Executing sheets operation...")

    def _is_timed_out(self) -> bool:
        """Check if session has timed out"""
        if self.state == SheetsWriteState.PREVIEW_GENERATED:
            elapsed = datetime.now() - self.request.requested_at
            return elapsed > timedelta(minutes=self.timeout_minutes)
        elif self.state == SheetsWriteState.UNLOCKED:
            elapsed = datetime.now() - self.unlocked_at
            return elapsed > timedelta(minutes=self.timeout_minutes)
        return False

    def mark_completed(self):
        """Mark operation as completed"""
        self.state = SheetsWriteState.COMPLETED
        if self.session_file and self.session_file.exists():
            self.session_file.unlink()

    def _save_to_file(self):
        """Save session state to file"""
        if not self.session_file:
            return

        self.session_file.parent.mkdir(parents=True, exist_ok=True)

        session_data = {
            "approval_code": self.approval_code,
            "state": self.state.value,
            "unlocked_at": self.unlocked_at.isoformat() if self.unlocked_at else None,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "request": {
                "operation_type": self.request.operation_type,
                "spreadsheet_id": self.request.spreadsheet_id,
                "spreadsheet_name": self.request.spreadsheet_name,
                "sheet_name": self.request.sheet_name,
                "range_notation": self.request.range_notation,
                "description": self.request.description,
                "dry_run_preview": self.request.dry_run_preview,
                "requested_by": self.request.requested_by,
                "requested_at": self.request.requested_at.isoformat()
            }
        }

        with open(self.session_file, 'w') as f:
            json.dump(session_data, f, indent=2)


class SheetsWriteGuard:
    """Enforces two-step approval for destructive Google Sheets operations"""

    def __init__(self, sessions_dir: Optional[Path] = None):
        self.current_session: Optional[SheetsWriteSession] = None

        if sessions_dir is None:
            base_dir = Path(__file__).parent.parent / "data" / "sheets_sessions"
            self.sessions_dir = base_dir
        else:
            self.sessions_dir = sessions_dir

        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def requires_approval(self, operation_type: str) -> bool:
        """Check if an operation type requires approval"""
        return operation_type in DESTRUCTIVE_OPERATIONS

    def execute(
        self,
        request: SheetsWriteRequest,
        write_callable: Callable,
        *args,
        **kwargs
    ) -> Dict[str, Any]:
        """Execute a sheets write with safety checks

        Args:
            request: SheetsWriteRequest describing the operation
            write_callable: Function that performs the actual write
            *args, **kwargs: Arguments to pass to write_callable

        Returns:
            Dict with status and message
        """
        # Check if this operation needs approval
        if not self.requires_approval(request.operation_type):
            # Safe operation, execute directly
            try:
                result = write_callable(*args, **kwargs)
                return {
                    "status": "completed",
                    "message": "Operation completed (no approval required)",
                    "data": result
                }
            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Operation failed: {str(e)}",
                    "error": str(e)
                }

        # Destructive operation - require approval
        if self.current_session is None:
            session_file = self.sessions_dir / f"sheets_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            self.current_session = SheetsWriteSession(request, session_file)
            preview = self.current_session.generate_preview()
            return {
                "status": "preview_generated",
                "message": preview,
                "approval_code": self.current_session.approval_code
            }

        if self.current_session.state == SheetsWriteState.EXECUTING:
            try:
                result = write_callable(*args, **kwargs)
                self.current_session.mark_completed()
                self.current_session = None

                return {
                    "status": "completed",
                    "message": "Sheets operation completed successfully",
                    "data": result
                }

            except Exception as e:
                self.current_session = None
                return {
                    "status": "error",
                    "message": f"Sheets operation failed: {str(e)}",
                    "error": str(e)
                }

        return {
            "status": "error",
            "message": "Invalid state. Please start with a new request."
        }

    def verify_user_input(self, user_message: str) -> Dict[str, Any]:
        """Process user input for approval flow"""
        if self.current_session is None:
            return {
                "status": "error",
                "message": "No active sheets session."
            }

        if self.current_session.state == SheetsWriteState.PREVIEW_GENERATED:
            success, message = self.current_session.verify_unlock(user_message)
            if success:
                return {"status": "awaiting_post", "message": message}
            else:
                if self.current_session.state == SheetsWriteState.CANCELLED:
                    self.current_session = None
                return {"status": "error", "message": message}

        elif self.current_session.state == SheetsWriteState.UNLOCKED:
            success, message = self.current_session.verify_post_command(user_message)
            if success:
                return {"status": "ready_to_execute", "message": message}
            else:
                if self.current_session.state == SheetsWriteState.CANCELLED:
                    self.current_session = None
                return {"status": "error", "message": message}

        return {
            "status": "error",
            "message": f"Unexpected state: {self.current_session.state.value}"
        }

    def reset_session(self):
        """Reset current session"""
        self.current_session = None


# Singleton instance
_sheets_guard_instance = None

def get_sheets_write_guard() -> SheetsWriteGuard:
    """Get the global SheetsWriteGuard instance"""
    global _sheets_guard_instance
    if _sheets_guard_instance is None:
        _sheets_guard_instance = SheetsWriteGuard()
    return _sheets_guard_instance


if __name__ == "__main__":
    print("Testing SheetsWriteGuard...\n")

    guard = SheetsWriteGuard()

    request = SheetsWriteRequest(
        operation_type="CLEAR_SHEET",
        spreadsheet_id="1abc123xyz",
        spreadsheet_name="Monthly Report",
        sheet_name="Raw Data",
        description="Clear data before monthly refresh",
        dry_run_preview={
            "rows_to_clear": 500,
            "columns_to_clear": 15,
            "sample_headers": ["Date", "Account", "Spend", "Clicks"]
        }
    )

    def mock_clear(*args, **kwargs):
        return {"cells_cleared": 7500}

    result = guard.execute(request, mock_clear)
    print(result["message"])
