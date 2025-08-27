import OpenAI from "openai";
import type { MoveRating } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface MoveEvaluation {
  rating: MoveRating;
  explanation: string;
  score: number; // 1-10 scale for match scoring
}

export async function evaluateMessage(
  message: string,
  context: string = "",
  previousMessages: Array<{content: string, rating?: string}> = []
): Promise<MoveEvaluation> {
  try {
    const contextInfo = context || "This is a competitive messaging game where players take turns sending tactical messages.";
    const messageHistory = previousMessages.length > 0 
      ? `Previous messages in this match:\n${previousMessages.map((msg, i) => `${i+1}. "${msg.content}" (${msg.rating || 'unrated'})`).join('\n')}\n\n`
      : "";

    const prompt = `You are an expert judge for a competitive tactical messaging game. Players take turns sending messages and you evaluate them based on:

1. **Strategic Value**: How well does the message advance the player's position?
2. **Psychological Impact**: Does it effectively influence or pressure the opponent?
3. **Clarity & Precision**: Is the message clear, well-structured, and impactful?
4. **Tactical Sophistication**: Shows deep understanding of competitive dynamics?

${messageHistory}Current message to evaluate: "${message}"

Context: ${contextInfo}

Rate this message using these categories:
- **Brilliant**: Exceptional strategic insight, perfect execution, game-changing
- **Great**: Strong tactical value, well-executed, significant impact
- **Excellent**: Good strategic thinking, effective execution
- **Good**: Solid message, decent tactical value
- **Miss**: Lacks strategic value or impact
- **Mistake**: Poor tactical choice, may backfire
- **Blunder**: Severely damaging to player's position

Provide your response in JSON format:
{
  "rating": "brilliant|great|excellent|good|miss|mistake|blunder",
  "explanation": "Brief explanation of why this rating was given (max 100 words)",
  "score": number between 1-10 for match scoring
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert judge for competitive tactical messaging. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Validate and sanitize the response
    const validRatings: MoveRating[] = ['brilliant', 'great', 'excellent', 'good', 'miss', 'mistake', 'blunder'];
    const rating = validRatings.includes(result.rating) ? result.rating : 'good';
    const score = Math.max(1, Math.min(10, result.score || 5));
    const explanation = result.explanation || "Move evaluated based on tactical messaging criteria.";

    return {
      rating,
      explanation: explanation.slice(0, 200), // Ensure reasonable length
      score,
    };
  } catch (error) {
    console.error("Failed to evaluate message with OpenAI:", error);
    // Fallback rating
    return {
      rating: 'good',
      explanation: "Message evaluation temporarily unavailable.",
      score: 5,
    };
  }
}

export async function determineMatchWinner(
  player1Messages: Array<{rating: string, score: number}>,
  player2Messages: Array<{rating: string, score: number}>
): Promise<{
  winnerId: 1 | 2 | null; // null for tie
  player1Score: number;
  player2Score: number;
  explanation: string;
}> {
  try {
    const player1Score = player1Messages.reduce((sum, msg) => sum + msg.score, 0) / Math.max(player1Messages.length, 1);
    const player2Score = player2Messages.reduce((sum, msg) => sum + msg.score, 0) / Math.max(player2Messages.length, 1);

    let winnerId: 1 | 2 | null = null;
    if (player1Score > player2Score) winnerId = 1;
    else if (player2Score > player1Score) winnerId = 2;

    const explanation = `Match completed. Player 1 average: ${player1Score.toFixed(1)}/10, Player 2 average: ${player2Score.toFixed(1)}/10`;

    return {
      winnerId,
      player1Score: Math.round(player1Score * 10) / 10,
      player2Score: Math.round(player2Score * 10) / 10,
      explanation,
    };
  } catch (error) {
    console.error("Failed to determine match winner:", error);
    return {
      winnerId: null,
      player1Score: 5,
      player2Score: 5,
      explanation: "Match result could not be determined.",
    };
  }
}
