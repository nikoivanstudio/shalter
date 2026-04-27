"use client"

import dynamic from "next/dynamic"

import type { ContactsHomeProps } from "@/features/contacts/ui/contacts-home"

const ContactsHomeNoSsr = dynamic(
  () => import("@/features/contacts/ui/contacts-home").then((module) => module.ContactsHome),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Loading contacts...</div>,
  }
)

export function ContactsHomeClient(props: ContactsHomeProps) {
  return <ContactsHomeNoSsr {...props} />
}
