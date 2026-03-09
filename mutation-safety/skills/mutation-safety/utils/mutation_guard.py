"""MutationGuard - Safety System for Google Ads Mutations

ALL mutations to Google Ads accounts MUST go through this guard.
Enforces two-step approval process for any live changes.

Architecture:
- Single point of enforcement for all mutations
- State machine tracks approval flow
- Auto-invoked by agents/scripts/skills
- Impossible to bypass (by design)

Usage:
    from utils.mutation_guard import MutationGuard, MutationRequest

    # Create mutation request
    request = MutationRequest(
        operation_type="ADD_KEYWORDS",
        account_cid="1234567890",
        account_name="Example Account",
        description="Add 50 negative keywords",
        dry_run_preview={
            "keywords_to_add": 50,
            "sample": ["competitor name", "irrelevant term"]
        }
    )

    # Execute through guard (handles all safety)
    guard = MutationGuard()
    result = guard.execute(request, mutation_callable)
"""

import sys
import io
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import json

# Fix encoding for Windows console
if sys.stdout:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Handle imports for both module and script usage
try:
    from utils.mutation_logger import MutationLogger, generate_approval_code
except ModuleNotFoundError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from utils.mutation_logger import MutationLogger, generate_approval_code


class MutationState(Enum):
    """State machine for mutation approval flow"""
    INITIAL = "initial"
    PREVIEW_GENERATED = "preview_generated"
    UNLOCKED = "unlocked"
    EXECUTING = "executing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class MutationRequest:
    """Represents a request to mutate Google Ads account(s)"""
    operation_type: str  # ADD_KEYWORDS, UPDATE_BUDGET, CREATE_CAMPAIGN, etc.
    account_cid: str  # Customer ID
    account_name: str  # Human-readable name
    description: str  # What this mutation does
    dry_run_preview: Dict[str, Any]  # Preview data to show user

    # Metadata
    requested_by: str = "user"  # Who requested this (user, agent, script)
    requested_at: datetime = None

    def __post_init__(self):
        if self.requested_at is None:
            self.requested_at = datetime.now()


class MutationSession:
    """Tracks state for a single mutation session"""

    def __init__(self, request: MutationRequest, session_file: Optional[Path] = None):
        self.request = request
        self.state = MutationState.INITIAL
        self.approval_code = None
        self.unlocked_at = None
        self.executed_at = None
        self.timeout_minutes = 10  # Reset if no action after 10 min
        self.session_file = session_file
        self.mutation_args = None
        self.mutation_kwargs = None

    def generate_preview(self) -> str:
        """Generate approval code and preview output"""
        self.approval_code = generate_approval_code()
        self.state = MutationState.PREVIEW_GENERATED
        self._save_to_file()
        return self._format_preview()

    def _format_preview(self) -> str:
        """Format dry-run preview for user"""
        lines = []
        lines.append("=" * 80)
        lines.append("DRY-RUN PREVIEW - NO CHANGES WILL BE MADE")
        lines.append("=" * 80)
        lines.append(f"\nOperation: {self.request.operation_type}")
        lines.append(f"Account: {self.request.account_name} (CID: {self.request.account_cid})")
        lines.append(f"Description: {self.request.description}")
        lines.append("\nPreview Details:")

        for key, value in self.request.dry_run_preview.items():
            if isinstance(value, list) and len(value) > 5:
                lines.append(f"  {key}: {value[:5]}... ({len(value)} total)")
            else:
                lines.append(f"  {key}: {value}")

        lines.append("\n" + "=" * 80)
        lines.append("TO PROCEED WITH THIS CHANGE:")
        lines.append("=" * 80)
        lines.append("\nStep 1: Respond with:")
        lines.append(f'  "I approve {self.approval_code}, unlock and ready to post"')
        lines.append("\n(Or say 'cancel' to abort)")
        lines.append("=" * 80)

        return "\n".join(lines)

    def verify_unlock(self, user_message: str) -> tuple[bool, str]:
        """Verify user provided correct approval code and unlock phrase"""
        if self.state != MutationState.PREVIEW_GENERATED:
            return (False, "Cannot unlock: No preview has been generated yet")

        if "cancel" in user_message.lower():
            self.state = MutationState.CANCELLED
            return (False, "Mutation cancelled by user")

        if self._is_timed_out():
            self.state = MutationState.INITIAL
            return (False, "Session timed out. Please re-run to generate new approval code.")

        if self.approval_code not in user_message:
            return (False, f"Approval code not found. Please include: {self.approval_code}")

        unlock_phrases = ["unlock and ready to post", "approved for unlock and ready to post"]
        if not any(phrase in user_message.lower() for phrase in unlock_phrases):
            return (False, "Unlock phrase not found. Please say: 'unlock and ready to post'")

        self.state = MutationState.UNLOCKED
        self.unlocked_at = datetime.now()
        self._save_to_file()

        lines = []
        lines.append("=" * 80)
        lines.append("APPROVAL VERIFIED")
        lines.append("=" * 80)
        lines.append(f"Approval Code: {self.approval_code}")
        lines.append(f"Operation: {self.request.operation_type}")
        lines.append(f"Account: {self.request.account_name} (CID: {self.request.account_cid})")
        lines.append("\nReady to execute this change.")
        lines.append("\n" + "=" * 80)
        lines.append("STEP 2: FINAL CONFIRMATION")
        lines.append("=" * 80)
        lines.append("\nTo execute now, respond with: POST NOW")
        lines.append("\n(Or say 'cancel' to abort)")
        lines.append("=" * 80)

        return (True, "\n".join(lines))

    def verify_post_command(self, user_message: str) -> tuple[bool, str]:
        """Verify user said 'POST NOW' to execute"""
        if self.state != MutationState.UNLOCKED:
            return (False, "Cannot post: Session not unlocked.")

        if "cancel" in user_message.lower():
            self.state = MutationState.CANCELLED
            return (False, "Mutation cancelled by user")

        if self._is_timed_out():
            self.state = MutationState.INITIAL
            return (False, "Session timed out. Please re-run to generate new approval code.")

        if "post now" not in user_message.lower():
            return (False, "To execute, you must say: POST NOW")

        self.state = MutationState.EXECUTING
        self.executed_at = datetime.now()

        return (True, "Executing changes...")

    def _is_timed_out(self) -> bool:
        """Check if session has timed out"""
        if self.state == MutationState.PREVIEW_GENERATED:
            elapsed = datetime.now() - self.request.requested_at
            return elapsed > timedelta(minutes=self.timeout_minutes)
        elif self.state == MutationState.UNLOCKED:
            elapsed = datetime.now() - self.unlocked_at
            return elapsed > timedelta(minutes=self.timeout_minutes)
        return False

    def mark_completed(self):
        """Mark mutation as completed"""
        self.state = MutationState.COMPLETED
        self._save_to_file()
        if self.session_file and self.session_file.exists():
            self.session_file.unlink()

    def _save_to_file(self):
        """Save session state to file for persistence"""
        if not self.session_file:
            return

        self.session_file.parent.mkdir(parents=True, exist_ok=True)

        session_data = {
            "approval_code": self.approval_code,
            "state": self.state.value,
            "unlocked_at": self.unlocked_at.isoformat() if self.unlocked_at else None,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "timeout_minutes": self.timeout_minutes,
            "request": {
                "operation_type": self.request.operation_type,
                "account_cid": self.request.account_cid,
                "account_name": self.request.account_name,
                "description": self.request.description,
                "dry_run_preview": self.request.dry_run_preview,
                "requested_by": self.request.requested_by,
                "requested_at": self.request.requested_at.isoformat()
            }
        }

        with open(self.session_file, 'w') as f:
            json.dump(session_data, f, indent=2)

    @classmethod
    def load_from_file(cls, session_file: Path) -> Optional['MutationSession']:
        """Load session state from file"""
        if not session_file.exists():
            return None

        try:
            with open(session_file, 'r') as f:
                session_data = json.load(f)

            request_data = session_data["request"]
            request = MutationRequest(
                operation_type=request_data["operation_type"],
                account_cid=request_data["account_cid"],
                account_name=request_data["account_name"],
                description=request_data["description"],
                dry_run_preview=request_data["dry_run_preview"],
                requested_by=request_data["requested_by"],
                requested_at=datetime.fromisoformat(request_data["requested_at"])
            )

            session = cls(request, session_file)
            session.approval_code = session_data["approval_code"]
            session.state = MutationState(session_data["state"])
            session.timeout_minutes = session_data["timeout_minutes"]

            if session_data["unlocked_at"]:
                session.unlocked_at = datetime.fromisoformat(session_data["unlocked_at"])
            if session_data["executed_at"]:
                session.executed_at = datetime.fromisoformat(session_data["executed_at"])

            return session

        except Exception as e:
            print(f"Warning: Could not load session from {session_file}: {e}")
            return None


class MutationGuard:
    """Enforces two-step approval for all Google Ads mutations"""

    def __init__(self, sessions_dir: Optional[Path] = None):
        self.logger = MutationLogger()
        self.current_session: Optional[MutationSession] = None

        if sessions_dir is None:
            base_dir = Path(__file__).parent.parent / "data" / "mutation_sessions"
            self.sessions_dir = base_dir
        else:
            self.sessions_dir = sessions_dir

        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def execute(
        self,
        request: MutationRequest,
        mutation_callable: Callable,
        *args,
        **kwargs
    ) -> Dict[str, Any]:
        """Execute a mutation with safety checks

        This is the ONLY way to execute mutations safely.

        Args:
            request: MutationRequest describing the change
            mutation_callable: Function that performs the actual mutation
            *args, **kwargs: Arguments to pass to mutation_callable

        Returns:
            Dict with status and message
        """
        if self.current_session is None:
            session_file = self.sessions_dir / f"session_{request.account_cid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            self.current_session = MutationSession(request, session_file)
            preview = self.current_session.generate_preview()
            return {
                "status": "preview_generated",
                "message": preview,
                "approval_code": self.current_session.approval_code
            }

        if self.current_session.state == MutationState.EXECUTING:
            try:
                result = mutation_callable(*args, **kwargs)

                self.logger.log_mutation(
                    approval_code=self.current_session.approval_code,
                    account_cid=request.account_cid,
                    account_name=request.account_name,
                    action_type=request.operation_type,
                    details={
                        "description": request.description,
                        "preview": request.dry_run_preview,
                        "result": result
                    },
                    success=True
                )

                self.current_session.mark_completed()
                self.current_session = None

                return {
                    "status": "completed",
                    "message": "Mutation completed successfully",
                    "data": result
                }

            except Exception as e:
                self.logger.log_mutation(
                    approval_code=self.current_session.approval_code,
                    account_cid=request.account_cid,
                    account_name=request.account_name,
                    action_type=request.operation_type,
                    details={
                        "description": request.description,
                        "preview": request.dry_run_preview
                    },
                    success=False,
                    error_message=str(e)
                )

                self.current_session = None

                return {
                    "status": "error",
                    "message": f"Mutation failed: {str(e)}",
                    "error": str(e)
                }

        return {
            "status": "error",
            "message": "Invalid state. Please start with a new mutation request."
        }

    def verify_user_input(self, user_message: str) -> Dict[str, Any]:
        """Process user input for approval flow"""
        if self.current_session is None:
            import re
            approval_code_match = re.search(r'APPROVE-\d{8}-\d{6}', user_message)
            if approval_code_match:
                approval_code = approval_code_match.group(0)
                if self.load_session_by_approval_code(approval_code):
                    pass
                else:
                    return {
                        "status": "error",
                        "message": f"No active session found with approval code: {approval_code}"
                    }
            else:
                return {
                    "status": "error",
                    "message": "No active mutation session. Please start with a mutation request."
                }

        if self.current_session.state == MutationState.PREVIEW_GENERATED:
            success, message = self.current_session.verify_unlock(user_message)
            if success:
                return {"status": "awaiting_post", "message": message}
            else:
                if self.current_session.state == MutationState.CANCELLED:
                    self.current_session = None
                return {"status": "error", "message": message}

        elif self.current_session.state == MutationState.UNLOCKED:
            success, message = self.current_session.verify_post_command(user_message)
            if success:
                return {"status": "ready_to_execute", "message": message}
            else:
                if self.current_session.state == MutationState.CANCELLED:
                    self.current_session = None
                return {"status": "error", "message": message}

        return {
            "status": "error",
            "message": f"Unexpected state: {self.current_session.state.value}"
        }

    def reset_session(self):
        """Reset current session"""
        self.current_session = None

    def load_session_by_approval_code(self, approval_code: str) -> bool:
        """Load a session from disk by its approval code"""
        for session_file in self.sessions_dir.glob("session_*.json"):
            try:
                session = MutationSession.load_from_file(session_file)
                if session and session.approval_code == approval_code:
                    self.current_session = session
                    return True
            except Exception:
                continue
        return False

    def list_active_sessions(self) -> list:
        """List all active (non-completed) sessions"""
        active_sessions = []
        for session_file in self.sessions_dir.glob("session_*.json"):
            try:
                session = MutationSession.load_from_file(session_file)
                if session and session.state != MutationState.COMPLETED:
                    active_sessions.append({
                        "approval_code": session.approval_code,
                        "account": f"{session.request.account_name} ({session.request.account_cid})",
                        "operation": session.request.operation_type,
                        "state": session.state.value,
                        "created": session.request.requested_at.isoformat()
                    })
            except Exception:
                continue
        return active_sessions


# Singleton instance
_guard_instance = None

def get_mutation_guard() -> MutationGuard:
    """Get the global MutationGuard instance"""
    global _guard_instance
    if _guard_instance is None:
        _guard_instance = MutationGuard()
    return _guard_instance


if __name__ == "__main__":
    print("Testing MutationGuard...\n")

    guard = MutationGuard()

    request = MutationRequest(
        operation_type="ADD_KEYWORDS",
        account_cid="1234567890",
        account_name="Test Account",
        description="Add 10 negative keywords",
        dry_run_preview={
            "keywords_to_add": 10,
            "sample_keywords": ["competitor", "irrelevant", "wrong intent"]
        }
    )

    def mock_mutation(*args, **kwargs):
        return {"keywords_added": 10, "status": "success"}

    result = guard.execute(request, mock_mutation)
    print(result["message"])
