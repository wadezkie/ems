/** Options of the "All Status" dropdown on My Assigned Task (shared by server and client). */
export const TASK_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "for_review", label: "For Review" },
  { value: "needs_revision", label: "Needs Revision" },
  { value: "completed", label: "Completed" },
] as const;
