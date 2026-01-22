export const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength)
  return truncated.slice(0, truncated.lastIndexOf(" ")) + "..."
}

export const highlightText = (text: string, searchQuery: string) => {
  if (!searchQuery) return text
  const regex = new RegExp(`(${searchQuery})`, "gi")
  return text.replace(regex, "<mark>$1</mark>")
}

export const extractCodeBlocks = (markdown: string) => {
  const matches = markdown.match(/```[\s\S]*?```/g)
  return matches || []
}
