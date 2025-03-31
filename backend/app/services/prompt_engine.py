from typing import Dict, Any, List, Optional, Union # Add Union
from ..models.enums import UserRole
from ..models.schemas import PromptTemplate, ChatHistoryItem, SimpleHistoryItem # Import both history types

class PromptEngine:
    def __init__(self):
        self.templates = {
            UserRole.TECHNICAL: PromptTemplate(
                system_prompt="""You are an IFS ERP technical expert. Provide detailed
                technical responses including code examples where appropriate. Focus on
                implementation details, API usage, and technical best practices.""",
                response_format={
                    "sections": ["Technical Overview", "Implementation Details",
                               "Code Examples", "Best Practices", "Considerations"]
                }
            ),
            UserRole.FUNCTIONAL: PromptTemplate(
                system_prompt="""You are an IFS ERP functional consultant. Explain
                concepts in business terms, focusing on processes and business impact.
                Avoid technical jargon unless necessary.""",
                response_format={
                    "sections": ["Business Context", "Process Overview",
                               "Impact Analysis", "Recommendations"]
                }
            ),
            UserRole.ADMINISTRATOR: PromptTemplate(
                system_prompt="""You are an IFS ERP system administrator. Focus on
                system configuration, security, performance tuning, and maintenance
                procedures. Provide step-by-step instructions.""",
                response_format={
                    "sections": ["Administrative Overview", "Configuration Steps",
                               "Security Considerations", "Maintenance Tasks",
                               "Troubleshooting"]
                }
            ),
            UserRole.KEY_USER: PromptTemplate(
                system_prompt="""You are an IFS ERP key user expert. Provide practical
                guidance on daily operations, best practices, and common workflows.
                Include tips for training end users.""",
                response_format={
                    "sections": ["Process Summary", "Step-by-Step Guide",
                               "Best Practices", "Common Issues", "Training Tips"]
                }
            ),
            UserRole.END_USER: PromptTemplate(
                system_prompt="""You are an IFS ERP End User specialist. Provide
                simple, clear instructions using everyday language. Focus on practical,
                task-oriented guidance.""",
                response_format={
                    "sections": ["Simple Overview", "Quick Steps",
                               "Tips and Tricks", "Common Questions"]
                }
            ),
            UserRole.PROJECT_MANAGER: PromptTemplate(
                system_prompt="""You are an IFS ERP project management expert. Focus
                on implementation strategies, timelines, resource planning, and risk
                management.""",
                response_format={
                    "sections": ["Project Overview", "Implementation Strategy",
                               "Resource Requirements", "Risk Analysis",
                               "Timeline Considerations"]
                }
            ),
            UserRole.TESTER: PromptTemplate(
                system_prompt="""You are an IFS ERP testing specialist. Provide
                guidance on test planning, test cases, and quality assurance
                procedures.""",
                response_format={
                    "sections": ["Testing Approach", "Test Scenarios",
                               "Validation Steps", "Quality Checks",
                               "Common Issues"]
                }
            )
        }

    def generate_prompt(
        self,
        query: str,
        role: UserRole,
        history: Optional[Union[List[ChatHistoryItem], List[SimpleHistoryItem]]] = None # Updated type hint
    ) -> str:
        template = self.templates.get(role)
        if not template:
            raise ValueError(f"No template found for role: {role}")

        # Format history based on its type
        history_str = ""
        if history:
            history_str += "CONVERSATION HISTORY:\n"
            # Check the type of the first item to determine format
            if history and isinstance(history[0], ChatHistoryItem):
                for item in history: # item is ChatHistoryItem
                    # Type assertion for clarity (optional but good practice)
                    history_item = item # type: ChatHistoryItem
                    history_str += f"User: {history_item.message.content}\n"
                    if history_item.response:
                        history_str += f"Assistant: {history_item.response.content}\n"
            elif history and isinstance(history[0], SimpleHistoryItem):
                 for item in history: # item is SimpleHistoryItem
                    # Type assertion for clarity
                    simple_item = item # type: SimpleHistoryItem
                    role_label = "User" if simple_item.role == "user" else "Assistant"
                    history_str += f"{role_label}: {simple_item.content}\n"

            history_str += "\n---\n\n" # Separator

        # Construct the final prompt
        prompt_parts = [
            template.system_prompt,
            history_str, # Include formatted history here
            f"CURRENT QUERY:\nUser: {query}\n",
            "RESPONSE STRUCTURE:",
            f"Please structure your response using the following sections: {', '.join(template.response_format['sections'])}",
            "\nFORMATTING:",
            "- Use standard Markdown for all formatting (headings, lists, bold, italics, etc.).",
            "- **ONLY** use Markdown code blocks (```language ... ```) for actual code snippets (e.g., SQL, Python, API payloads). Do **NOT** wrap the entire response or regular text in code blocks.",
            "- Use bullet points (-) or numbered lists (1.) for lists.",
            "- Use Markdown tables (| Header | ... |) for structured data or statistics.",
            "- Use bold (**text**) and italics (*text*) for emphasis.",
            "\nREMEMBER:",
            f"1. Use appropriate terminology for a {role.value} user.",
            "2. Provide practical examples where relevant.",
            "3. Include any necessary warnings or considerations.",
            "4. If the user's CURRENT QUERY is very short, conversational (like 'ok', 'thanks', 'that is good'), or unclear, provide a brief acknowledgement or ask a clarifying question instead of generating a full, structured response."
        ]

        return "\n".join(prompt_parts)