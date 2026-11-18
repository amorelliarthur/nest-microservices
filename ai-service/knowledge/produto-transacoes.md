---
id: produto-transacoes
title: Transações
category: produto
---

## Tipos de transação

Existem três tipos de transação: depósito (DEPOSIT), que coloca dinheiro na conta; saque (WITHDRAWAL), que retira dinheiro da conta; e transferência (TRANSFER), que envia dinheiro para outra conta.

## Valor mínimo de uma transação

O valor mínimo de qualquer transação, seja depósito, saque ou transferência, é de R$ 0,01.

## Por que a transação aparece como pendente

As transações são processadas em segundo plano. Ao pedir um depósito, saque ou transferência, o sistema registra a transação e responde imediatamente com o identificador dela e o status "pendente" (PENDING). O processamento é concluído logo depois. Enquanto isso, a transação aparece no extrato como pendente, e o saldo só muda quando ela é concluída (COMPLETED).

## Saldo insuficiente

Um saque ou uma transferência só é concluído se a conta tiver saldo suficiente. Quando o saldo é insuficiente, a transação é recusada de forma definitiva, sem novas tentativas: ela fica registrada com o status "falhou" (FAILED) e o motivo "Saldo insuficiente", e o saldo da conta não muda.

## Como saber se uma transação foi concluída

Cada transação pode ser consultada pelo seu identificador, devolvido no momento do pedido. A consulta mostra o status: pendente (PENDING), concluída (COMPLETED) ou falhou (FAILED). Quando a transação falha, a consulta também mostra o motivo. Falhas de regra, como saldo insuficiente ou conta não encontrada, trazem a explicação da regra. Falhas técnicas são processadas em até três tentativas automáticas; se todas falharem, o motivo exibido é "Não foi possível processar a transação". Somente o dono da conta e administradores podem consultar uma transação.

## Quem pode movimentar uma conta

Somente o dono da conta pode fazer depósitos, saques e transferências a partir dela. Administradores do sistema também podem movimentar qualquer conta.

## Como funciona uma transferência

Uma transferência pode ser feita para outra conta ativa, inclusive para a conta poupança do próprio usuário. Ela gera dois registros: na conta de origem, aparece uma saída do tipo transferência; na conta de destino, aparece uma entrada do tipo depósito, com a descrição "Transferência recebida de" seguida do identificador da conta de origem. Saída e entrada acontecem juntas: ou as duas são registradas, ou nenhuma é.

## Transferência para a mesma conta

Não é possível fazer uma transferência em que a conta de origem e a conta de destino são a mesma. Esse pedido é recusado imediatamente, antes de ser processado.

## Transferência para a própria poupança não é gasto

Transferir dinheiro da conta corrente para a própria poupança diminui o saldo da conta corrente, mas o dinheiro continua sendo do usuário. Por isso, o assistente apresenta gastos e transferências separadamente.
