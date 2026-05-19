# Princípios de Design — Criation.io

## 1. Dado é o herói. Decoração é distração.

Cada elemento na tela existe para comunicar informação ou facilitar uma ação. Ilustrações genéricas, blobs 3D, gradientes decorativos pesados, ícones meramente estéticos — proibidos em telas de produto. Aceitos apenas em landing pages públicas.

## 2. Densidade respeitada, não comprimida.

O usuário olha dezenas de métricas por minuto. Hierarquia clara via tamanho/peso/cor (não via caixas), respiro vertical generoso entre seções (32px+) com aperto interno onde faz sentido.

## 3. Dark é padrão, não opção.

Dark mode desenhado primeiro. Light existe para configurações, onboarding e exportações.

## 4. Cor é semântica, não estética.

Verde = positivo. Vermelho = negativo. Âmbar = atenção. Violeta = ação primária do produto. As 4 cores de gargalo (violeta, laranja, azul, vermelho) são intocáveis.

## 5. Números são tabulares, sempre.

`font-variant-numeric: tabular-nums` em todo número. Money sempre `R$` formato BR. Negativos com sinal e cor.

## 6. Movimento serve à compreensão.

Animações para guiar o olho. Duração 150–300ms. `prefers-reduced-motion` respeitado em 100%.

## 7. Acessibilidade é piso.

WCAG AA mínimo. Contraste de texto principal sobre fundo: 7:1+. Foco visível em todo elemento interativo. Navegação por teclado completa.

## 8. Marca é violeta, mas com restrição.

Violeta em CTAs primários, estados ativos de navegação, gargalo criativo. Não é background de tela, não é gradient hero em produto interno. Sua presença pontual é o que dá força.
