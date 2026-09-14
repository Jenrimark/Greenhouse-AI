import type { StoryEntry } from './types'

export function unwrapStories(response: { data?: { items?: StoryEntry[] } }): StoryEntry[] {
  return response.data?.items ?? []
}

export function storyPayload(title: string, org: string, bulletsText: string) {
  return {
    title: title.trim(),
    org: org.trim(),
    bullets: bulletsText.split('\n').filter((bullet) => bullet.trim()),
  }
}
