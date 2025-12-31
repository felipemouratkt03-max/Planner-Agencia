
import { GoogleGenAI, Type } from "@google/genai";
import { Project, Task } from "../types";

export const geminiService = {
  /**
   * Generates a professional, high-end marketing proposal.
   */
  async generatePremiumProposal(project: Project) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const formattedDate = new Date(project.start_date).toLocaleDateString('pt-BR');
    
    const prompt = `
      Atue como um Diretor de Estratégia Senior de uma agência de marketing digital de elite.
      Transforme o seguinte objetivo de projeto em um Documento Estratégico Premium.
      
      OBJETIVO DO PROJETO: "${project.objectives}"
      NOME DO PROJETO: "${project.name}"
      DATA DE INÍCIO OFICIAL: "${formattedDate}"
      
      REGRAS DE FORMATAÇÃO CRÍTICAS:
      1. NÃO use asteriscos triplos (***). Use no máximo duplos (**) para negrito importante.
      2. O tom deve ser executivo, direto e sem "encheção de linguiça".
      3. Use títulos claros (H1 e H2).
      4. O documento DEVE conter uma seção clara: "## 📅 Cronograma e Início da Operação" mencionando a data de ${formattedDate}.
      5. O Cronograma de Execução DEVE ser uma TABELA Markdown simples com as colunas: "Etapa" | "Data Estimada" | "Objetivo".
      6. Remova espaços em branco inúteis e caracteres especiais estranhos.
      
      Estrutura:
      - # 💎 ESTRATÉGIA MASTER: [Nome do Projeto]
      - ## 🚀 Início da Operação: ${formattedDate}
      - ## 🎯 Visão e KPIs de Sucesso
      - ## 💡 Pilares da Operação
      - ## 📅 Cronograma de Ativação (EM TABELA)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text;
  },

  /**
   * Extracts actionable tasks with logical scheduling.
   */
  async extractTasksFromStrategy(strategyText: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base neste documento estratégico: "${strategyText}", extraia as 8 tarefas iniciais para o Kanban.
      Para cada tarefa, defina um "day_offset" (número de dias após o início do projeto).
      Forneça o resultado estritamente em JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
              day_offset: { type: Type.INTEGER }
            },
            required: ["title", "description", "category", "priority", "day_offset"]
          }
        }
      }
    });
    return JSON.parse(response.text);
  }
};
