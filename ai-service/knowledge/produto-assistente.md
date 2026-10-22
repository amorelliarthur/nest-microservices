---
id: produto-assistente
title: Assistente financeiro e classificação de transações
category: produto
---

## O que o assistente financeiro faz

O assistente responde perguntas em linguagem natural sobre as finanças do usuário, como saldo das contas, gastos em um período e lista de transações. Ele consulta apenas os dados do próprio usuário que está conectado.

## O que o assistente não faz

O assistente apenas consulta dados. Ele não faz depósitos, saques nem transferências, e não consegue acessar contas de outras pessoas.

## Como o assistente calcula os gastos

Os totais de cada conta são calculados pelo sistema, e não estimados pela inteligência artificial. Em cada conta, gastos (saques) e transferências enviadas são somados separadamente, e as entradas aparecem em um total próprio. Quando a pergunta envolve mais de uma conta, a soma entre as contas é feita pelo assistente.

## Como o assistente entende os períodos

Expressões como "este mês" e "mês passado" são interpretadas com base na data atual. Os períodos consideram o fuso horário UTC, então uma transação feita perto da meia-noite pode aparecer no dia seguinte.

## Tamanho da pergunta

Cada pergunta ao assistente deve ter entre 3 e 500 caracteres. Cada pergunta é respondida de forma independente: o assistente ainda não se lembra das perguntas anteriores.

## Categorias da classificação automática

A classificação automática coloca a descrição de uma transação em uma destas categorias: alimentação, transporte, moradia, saúde, lazer, educação ou outros.

## Quando a classificação pede revisão

A classificação indica que precisa de revisão humana em dois casos: quando a confiança da classificação é menor que 70%, ou quando a categoria escolhida é "outros", que normalmente indica que nenhuma categoria específica se aplica.
