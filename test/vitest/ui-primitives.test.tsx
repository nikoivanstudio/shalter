import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants } from "@/components/ui/tabs"
import { ThemeProvider } from "@/features/theme/model/theme-provider"

describe("ui primitives", () => {
  test("button and card render variants", () => {
    render(
      <div>
        <Button variant="destructive">Delete</Button>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
            <CardAction>Action</CardAction>
          </CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      </div>
    )

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(buttonVariants({ variant: "outline", size: "icon-sm" })).toContain("border-border")
  })

  test("input, label, separator and toaster render", () => {
    render(
      <ThemeProvider>
        <Label htmlFor="field">Field</Label>
        <Input id="field" defaultValue="value" />
        <Separator orientation="vertical" />
        <Toaster richColors />
      </ThemeProvider>
    )

    expect(screen.getByLabelText("Field")).toHaveValue("value")
    expect(screen.getByTestId("toaster")).toBeInTheDocument()
  })

  test("tabs and dropdown menu render interactive content", async () => {
    render(
      <div>
        <Tabs defaultValue="one" orientation="vertical">
          <TabsList variant="line">
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel One</TabsContent>
          <TabsContent value="two">Panel Two</TabsContent>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger aria-label="open">Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
            <DropdownMenuCheckboxItem checked>Checked</DropdownMenuCheckboxItem>
            <DropdownMenuRadioGroup value="one">
              <DropdownMenuRadioItem value="one">Radio</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  Nested
                  <DropdownMenuShortcut>Cmd+K</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )

    expect(screen.getByText("Panel One")).toBeInTheDocument()
    expect(tabsListVariants({ variant: "line" })).toContain("bg-transparent")

    fireEvent.click(screen.getByLabelText("open"))
    expect(await screen.findByText("Item")).toBeInTheDocument()
    expect(screen.getByText("Checked")).toBeInTheDocument()
  })
})
