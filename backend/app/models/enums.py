from enum import Enum

class UserRole(Enum):
    FUNCTIONAL = "functional"
    TECHNICAL = "technical"
    ADMINISTRATOR = "administrator"
    KEY_USER = "key_user"
    END_USER = "end_user"
    PROJECT_MANAGER = "project_manager"
    TESTER = "tester" 