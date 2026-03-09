"""Mutation Logger - Audit Trail for Google Ads Changes

Logs all mutations (changes) made to Google Ads accounts for audit trail and troubleshooting.

Features:
- JSON Lines format for machine-readable logs
- Human-readable summary file
- Automatic timestamp and approval code tracking
- Detailed before/after state capture

Usage:
    from utils.mutation_logger import MutationLogger

    logger = MutationLogger()
    logger.log_mutation(
        approval_code="APPROVE-20251028-143052",
        account_cid="1234567890",
        account_name="Example Account",
        action_type="ADD_KEYWORDS",
        details={
            "shared_set_id": 123456,
            "keywords_added": ["term1", "term2"],
            "keywords_count": 2
        },
        success=True
    )
"""

import json
from datetime import datetime
from pathlib import Path


class MutationLogger:
    """Logs all mutations to Google Ads accounts"""

    def __init__(self, log_dir: str = "logs"):
        """Initialize logger with log directory"""
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        self.jsonl_log = self.log_dir / "mutations_log.jsonl"
        self.summary_log = self.log_dir / "mutations_summary.txt"

    def log_mutation(
        self,
        approval_code: str,
        account_cid: str,
        account_name: str,
        action_type: str,
        details: dict,
        success: bool,
        error_message: str = None
    ):
        """Log a mutation to both JSON and human-readable formats

        Args:
            approval_code: Unique approval code for this operation
            account_cid: Google Ads Customer ID
            account_name: Human-readable account name
            action_type: Type of mutation (CREATE_SHARED_SET, ADD_KEYWORDS, etc.)
            details: Dictionary with mutation-specific details
            success: Whether the mutation succeeded
            error_message: Error message if mutation failed
        """
        timestamp = datetime.now().isoformat()

        log_entry = {
            "timestamp": timestamp,
            "approval_code": approval_code,
            "account": {
                "cid": account_cid,
                "name": account_name
            },
            "action_type": action_type,
            "details": details,
            "success": success,
            "error_message": error_message
        }

        # Write to JSON Lines log
        with open(self.jsonl_log, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + '\n')

        # Write to human-readable summary
        self._write_summary(log_entry)

    def _write_summary(self, log_entry: dict):
        """Write human-readable summary entry"""
        timestamp = log_entry['timestamp']
        approval_code = log_entry['approval_code']
        account_name = log_entry['account']['name']
        account_cid = log_entry['account']['cid']
        action_type = log_entry['action_type']
        success = log_entry['success']
        details = log_entry['details']

        status = "SUCCESS" if success else "FAILED"

        with open(self.summary_log, 'a', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write(f"{status} - {timestamp}\n")
            f.write("=" * 80 + "\n")
            f.write(f"Approval Code: {approval_code}\n")
            f.write(f"Account: {account_name} (CID: {account_cid})\n")
            f.write(f"Action: {action_type}\n")
            f.write("\nDetails:\n")

            for key, value in details.items():
                if isinstance(value, list) and len(value) > 10:
                    f.write(f"  {key}: [{len(value)} items]\n")
                    for i, item in enumerate(value[:5], 1):
                        f.write(f"    {i}. {item}\n")
                    f.write(f"    ... ({len(value) - 5} more)\n")
                else:
                    f.write(f"  {key}: {value}\n")

            if not success and log_entry.get('error_message'):
                f.write(f"\nError: {log_entry['error_message']}\n")

            f.write("\n")

    def get_session_summary(self, approval_code: str) -> list:
        """Get all mutations for a specific approval code/session"""
        if not self.jsonl_log.exists():
            return []

        mutations = []
        with open(self.jsonl_log, 'r', encoding='utf-8') as f:
            for line in f:
                entry = json.loads(line)
                if entry['approval_code'] == approval_code:
                    mutations.append(entry)

        return mutations

    def get_account_history(self, account_cid: str) -> list:
        """Get all mutations for a specific account"""
        if not self.jsonl_log.exists():
            return []

        mutations = []
        with open(self.jsonl_log, 'r', encoding='utf-8') as f:
            for line in f:
                entry = json.loads(line)
                if entry['account']['cid'] == account_cid:
                    mutations.append(entry)

        return mutations


def generate_approval_code() -> str:
    """Generate a unique approval code for this mutation session

    Format: APPROVE-YYYYMMDD-HHMMSS
    Example: APPROVE-20251028-143052
    """
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"APPROVE-{timestamp}"


def check_mutations_locked() -> tuple[bool, str]:
    """Check if live mutations are locked

    Returns:
        Tuple of (is_locked: bool, message: str)
    """
    lock_file = Path("LIVE_MUTATIONS_LOCKED")

    if lock_file.exists():
        return (True,
                "LIVE MUTATIONS LOCKED\n\n"
                "The LIVE_MUTATIONS_LOCKED file exists, preventing all live changes.\n"
                "Only DRY-RUN mode is allowed.\n\n"
                "To enable live mutations:\n"
                "1. Delete the LIVE_MUTATIONS_LOCKED file\n"
                "2. Re-run your command\n"
                "3. Review the dry-run preview carefully\n"
                "4. Provide the approval code to proceed")

    return (False, "")


def create_lock_file():
    """Create the mutations lock file after a successful mutation session"""
    lock_file = Path("LIVE_MUTATIONS_LOCKED")

    with open(lock_file, 'w', encoding='utf-8') as f:
        f.write("=" * 77 + "\n")
        f.write("LIVE MUTATIONS SAFETY LOCK\n")
        f.write("=" * 77 + "\n\n")
        f.write("This file prevents ALL live mutations to Google Ads accounts.\n\n")
        f.write("While this file exists, mutations will ONLY run in DRY-RUN mode.\n")
        f.write("No actual changes will be made to any Google Ads accounts.\n\n")
        f.write("TO ENABLE LIVE MUTATIONS:\n")
        f.write("1. Delete this file\n")
        f.write("2. Run your agent/script with dry-run first\n")
        f.write("3. Review the preview carefully\n")
        f.write("4. Provide the unique approval code when prompted\n\n")
        f.write("IMPORTANT:\n")
        f.write("- This file is automatically re-created after every mutation session\n")
        f.write("- This ensures you must explicitly unlock before each live operation\n\n")
        f.write(f"Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 77 + "\n")


if __name__ == "__main__":
    logger = MutationLogger()

    approval_code = generate_approval_code()
    print(f"Generated approval code: {approval_code}")

    logger.log_mutation(
        approval_code=approval_code,
        account_cid="1234567890",
        account_name="Test Account",
        action_type="ADD_KEYWORDS",
        details={
            "shared_set_id": 99999,
            "keywords_added": ["test keyword 1", "test keyword 2"],
            "keywords_count": 2
        },
        success=True
    )

    print(f"\nTest log entry written to:")
    print(f"  - {logger.jsonl_log}")
    print(f"  - {logger.summary_log}")
