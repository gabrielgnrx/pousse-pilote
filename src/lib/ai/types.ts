/**
 * Ce dont Pousse a besoin de l'API Messages, typé au plus juste. Le vrai client (SDK Anthropic, voir
 * client.ts) et le client simulé des tests (mock.ts) respectent cette interface : le reste du module
 * ne dépend pas des types internes du SDK.
 */

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } };

export interface MessageParams {
  model: string;
  max_tokens: number;
  /** Bloc système ; cache_control « ephemeral » met en cache la partie stable (catalogue, consignes). */
  system?: string | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
  messages: { role: "user" | "assistant"; content: string | ContentBlock[] }[];
  output_config?: {
    effort?: "low" | "medium" | "high";
    format?: { type: "json_schema"; schema: Record<string, unknown> };
  };
  thinking?: { type: "disabled" } | { type: "between_tools" } | { type: "adaptive" };
}

export interface ApiMessage {
  content: ({ type: "text"; text: string } | { type: string; [k: string]: unknown })[];
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number | null;
  };
}

export interface RequestOptions {
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface MessagesClient {
  messages: {
    create(params: MessageParams, options?: RequestOptions): Promise<ApiMessage>;
  };
}
