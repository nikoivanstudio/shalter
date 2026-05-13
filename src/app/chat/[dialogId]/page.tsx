import { redirect } from "next/navigation"

export default async function ChatLinkPage({
  params,
}: {
  params: Promise<{ dialogId: string }>
}) {
  const { dialogId } = await params
  redirect(`/chats?dialogId=${dialogId}`)
}
