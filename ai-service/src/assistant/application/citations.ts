export interface CitableSource {
  sourceId: string;
  document: string;
  section: string;
}

export interface Citation {
  id: number;
  document: string;
  section: string;
}

export interface ResolvedAnswer {
  answer: string;
  citations: Citation[];
  unknownSourceIds: string[];
}

export const toSourceId = (documentId: string, section: string): string => {
  const slug = section
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${documentId}#${slug}`;
};

// Fontes que as tools realmente devolveram nesta pergunta: só elas podem ser citadas
export class SourceCollector {
  private readonly sources = new Map<string, CitableSource>();

  add(source: CitableSource): void {
    this.sources.set(source.sourceId, source);
  }

  get(sourceId: string): CitableSource | undefined {
    return this.sources.get(sourceId);
  }
}

const CITATION_MARKER = /(\s?)\[([a-z0-9-]+#[a-z0-9-]+)\]/g;

export const resolveCitations = (
  answer: string,
  collector: SourceCollector,
): ResolvedAnswer => {
  const citations: Citation[] = [];
  const numbers = new Map<string, number>();
  const unknownSourceIds: string[] = [];

  const resolved = answer.replace(
    CITATION_MARKER,
    (_marker, space: string, sourceId: string) => {
      const source = collector.get(sourceId);
      // Citação de uma fonte que a busca não devolveu: removida, nunca exibida
      if (!source) {
        unknownSourceIds.push(sourceId);
        return '';
      }

      let number = numbers.get(sourceId);
      if (number === undefined) {
        number = citations.length + 1;
        numbers.set(sourceId, number);
        citations.push({
          id: number,
          document: source.document,
          section: source.section,
        });
      }
      return `${space}[${number}]`;
    },
  );

  return { answer: resolved, citations, unknownSourceIds };
};
