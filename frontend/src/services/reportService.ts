export interface CandidateReportResponse {
  candidateId: string;
  fieldId: string;
  facts: Record<string, unknown>;
  report: {
    text: string;
    source: string;
    rag_context?: Array<{
      id: string;
      similarity: number;
      content_text: string;
    }>;
  };
}

const DEFAULT_API_BASE = 'http://localhost:8000/api/v1';

export async function fetchCandidateReport(
  fieldId: string,
  candidateId: string,
  lang: 'en' | 'es' = 'en'
): Promise<CandidateReportResponse | null> {
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
    DEFAULT_API_BASE;
  const url = `${apiBase}/report/generate`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        field_id: fieldId,
        candidate_id: candidateId,
        lang,
      }),
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as CandidateReportResponse;
  } catch {
    return null;
  }
}
