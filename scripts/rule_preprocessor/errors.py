"""
Structured errors with source context for the rule source preprocessor.
"""


class PreprocessorError(Exception):
    """Compile-time error with source location context.

    Attributes:
        message: Human-readable error description.
        source_file: Path to the source file that caused the error.
        kind: Type of object (definition, profile, expansion).
        obj_id: Identifier of the object within the source.
        field: Dotted field path where the error occurred.
    """

    def __init__(
        self,
        message: str,
        source_file: str | None = None,
        kind: str | None = None,
        obj_id: str | None = None,
        field: str | None = None,
    ):
        self.message = message
        self.source_file = source_file
        self.kind = kind
        self.obj_id = obj_id
        self.field = field
        super().__init__(self._format())

    def _format(self) -> str:
        parts = [self.message]
        if self.source_file:
            parts.append(f"  source: {self.source_file}")
        if self.kind and self.obj_id:
            parts.append(f"  {self.kind}: {self.obj_id}")
        if self.field:
            parts.append(f"  field: {self.field}")
        return "\n".join(parts)
