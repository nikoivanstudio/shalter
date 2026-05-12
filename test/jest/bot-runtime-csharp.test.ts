import {
  buildBotReply,
  compileBotScript,
  createBotConfigFromScript,
} from "@/features/bots/lib/runtime"

describe("bot runtime C# script", () => {
  test("compiles a C#-style bot program and answers from rules", () => {
    const script = `using Shalter;

var bot = new ShalterBot(
    name: "Support Bot",
    niche: "Support",
    goal: "Help clearly",
    tone: "Calm"
);

bot.Greeting("""
Hello!
""");

bot.Guard("""
Stay accurate.
""");

bot.OnText(new[] { "price", "cost" }, """
Pricing depends on the task.
""");

bot.OnRegex(@"(bug|error)", """
This looks like a technical issue.
""", flags: "i");

bot.Default("""
Tell me a bit more.
""");`

    const program = compileBotScript(script)

    expect(program.errors).toEqual([])
    expect(program.name).toBe("Support Bot")
    expect(program.rules).toHaveLength(2)

    const config = createBotConfigFromScript(script, "support_bot")
    expect(config.name).toBe("Support Bot")
    expect(buildBotReply(config, "price please")).toContain("Pricing depends on the task.")
    expect(buildBotReply(config, "BUG")).toContain("This looks like a technical issue.")
  })
})
