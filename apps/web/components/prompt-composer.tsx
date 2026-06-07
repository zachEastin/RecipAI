import { Sparkles } from "lucide-react";

import { Button, Chip, TextArea } from "./ui";

const promptChips = ["Faster dinner", "Use leftovers", "Healthier", "Kid friendly"];

export function PromptComposer() {
  return (
    <section className="prompt-panel">
      <div className="prompt-heading">
        <Sparkles aria-hidden="true" size={22} />
        <div>
          <h2>Ask for a recipe</h2>
          <p>Get a structured recipe you can save, plan, shop, or cook.</p>
        </div>
      </div>
      <TextArea
        aria-label="Recipe prompt"
        defaultValue="Make a fast dinner with chicken, rice, and something fresh."
        rows={4}
      />
      <div className="chip-row">
        {promptChips.map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
      </div>
      <Button className="full-width">Generate recipe</Button>
    </section>
  );
}
