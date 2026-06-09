"use client";

import { Clock, Lightbulb, Replace, Sparkles, Users } from "lucide-react";

import type { AiStructuredResult, RecipeResult } from "@recipai/ai";

import { saveAiCookDraft } from "../cook/cook-client";
import { Button } from "../ui";

function RecipeResultCard({ result }: { result: RecipeResult }) {
  function startCooking() {
    saveAiCookDraft({
      title: result.title,
      summary: result.summary,
      servings: result.servings,
      totalMinutes: result.totalMinutes,
      ingredients: result.ingredients.map((ingredient) => ({
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        name: ingredient.name,
        note: ingredient.note
      })),
      steps: result.steps.map((step) => ({
        body: step.body,
        timerMinutes: step.timerMinutes
      }))
    });
    window.location.assign("/cook?draft=ai");
  }

  return (
    <article className="ai-result-card">
      <div className="ai-result-header">
        <div>
          <p className="result-label">Structured recipe</p>
          <h3>{result.title}</h3>
          <p>{result.summary}</p>
        </div>
        <Sparkles aria-hidden="true" size={22} />
      </div>
      <div className="meta-row">
        <span>
          <Clock aria-hidden="true" size={15} />
          {result.totalMinutes} min
        </span>
        <span>
          <Users aria-hidden="true" size={15} />
          {result.servings}
        </span>
        <span>{result.difficulty}</span>
      </div>
      <div className="tag-row">
        {result.tags.slice(0, 4).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="result-section">
        <h4>Ingredients</h4>
        <ul className="check-list">
          {result.ingredients.slice(0, 8).map((item) => (
            <li key={`${item.name}-${item.unit ?? "unit"}`}>
              <span />
              {item.quantity ? `${item.quantity} ` : ""}
              {item.unit ? `${item.unit} ` : ""}
              {item.name}
              {item.note ? `, ${item.note}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <div className="result-section">
        <h4>First steps</h4>
        <ol className="step-list">
          {result.steps.slice(0, 4).map((step, index) => (
            <li key={`${index}-${step.body}`}>{step.body}</li>
          ))}
        </ol>
      </div>
      {result.tips.length ? (
        <div className="tip-box">
          <Lightbulb aria-hidden="true" size={18} />
          {result.tips[0]}
        </div>
      ) : null}
      <div className="card-actions">
        <Button variant="secondary">Save recipe</Button>
        <Button onClick={startCooking} type="button">
          Start cooking
        </Button>
      </div>
    </article>
  );
}

export function AiResultView({ result }: { result: AiStructuredResult }) {
  if (result.type === "recipe-modification-result") {
    return (
      <article className="ai-result-card">
        <div className="ai-result-header">
          <div>
            <p className="result-label">Recipe changed</p>
            <h3>{result.title}</h3>
            <p>
              {result.servingImpact} {result.timeImpact}
            </p>
          </div>
          <Replace aria-hidden="true" size={22} />
        </div>
        <div className="result-section">
          <h4>What changed</h4>
          <ul className="change-list">
            {result.changeSummary.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
        <RecipeResultCard result={result.updatedRecipe} />
        <div className="card-actions">
          <Button variant="secondary">Save as new</Button>
          <Button>Replace original</Button>
        </div>
      </article>
    );
  }

  return <RecipeResultCard result={result} />;
}
