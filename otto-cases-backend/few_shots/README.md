# OTTO CASES - Few Shot Examples (Casos Padrão-Ouro)

Esta pasta foi desenhada para a técnica de **"Few-Shot Prompting"**.
A escrita do modelo de IA reflete primariamente os exemplos que ele recebe. 

## Como usar:
1. Após rodar seu Deep Research, encontre de 2 a 3 relatos de casos (Case Reports) perfeitos. Devem ter um vocabulário cirúrgico impecável, com jargão neutro, conciso e claro.
2. Cole o abstract e o artigo principal dentro de arquivos de texto aqui (`exemplo_1_qualidade_ouro.txt`).
3. Nosso backend `main.py` vai ler esses exemplos e passa-los para a OpenAI no `system_prompt` como o padrão a ser copiado.
