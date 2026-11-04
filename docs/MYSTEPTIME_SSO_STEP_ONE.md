# Mysteptime × Intranet STEP One — SSO preparado (NÃO habilitado)

## Estado confirmado em 2026-11-04

- O novo projeto Supabase de destino é `knzszyxsspdjzgqkfrdt`.
- Na última verificação, ainda possui **0 usuários**, **0 perfis** e **0 papéis**.
- O site acessado pelo usuário ainda é `https://mysteptime.lovable.app/` e pede login próprio.
- A Intranet não contém uma permissão chamada GoalFy na lista de `core.users.allowed_modules`. Os usuários elegíveis **não podem ser inferidos** de `offshore` ou `suprimentos:step-flow`.
- Em 2026-11-04, foram adicionados componentes do protocolo de login único ao GitHub, mas **nenhum SSO de produção foi ativado ou testado de ponta a ponta**.

## Componentes adicionados

Intranet (repositório `stepoil-debug/Intranetgeral-step`):

- `offshore:mysteptime` como permissão gerenciável na Gestão de Acessos.
- `POST /api/auth/mysteptime-launch`: valida sessão STEP One; quando habilitado, exige a permissão específica e emite ticket aleatório, TTL 60 segundos.
- `POST /api/auth/mysteptime-consume`: endpoint só para servidores, protegido por segredo compartilhado; reválida usuário, permissão e expiração e consome ticket de modo atômico.
- Card do Offshore aponta para rota de lançamento `/intranet/offshore/mysteptime`; enquanto SSO estiver desativado, permanece o link legado.

Mysteptime (repositório `stepoil-debug/mysteptime`):

- `POST /api/auth/intranet`: consome ticket pela API da Intranet, encontra conta existente no Supabase e gera um `token_hash` de magic link; não provisiona papéis nem aceita e-mail vindo do navegador.
- `/auth/intranet`: conclui login com `supabase.auth.verifyOtp`, criando sessão real do usuário no Supabase do Mysteptime.
- `BackToIntranet`: link para `https://intranet.step-og.com/intranet/offshore` visível no layout compartilhado.
- `VITE_MYSTEPTIME_SSO_ONLY=true`: substitui formulário de senha por chamada à Intranet, **apenas depois de autenticação integrada validada**.

## Variáveis privadas necessárias (não inserir em arquivos públicos)

Na Vercel da Intranet:

```env
MYSTEPTIME_SSO_ENABLED=false
MYSTEPTIME_SSO_ORIGIN=https://mysteptime.step-og.com
MYSTEPTIME_SSO_SHARED_SECRET=<32+ caracteres aleatórios; provisionar no painel, não aqui>
```

No servidor do Mysteptime, com mesmo segredo:

```env
MYSTEPTIME_SSO_ENABLED=false
MYSTEPTIME_SSO_SHARED_SECRET=<mesmo segredo do servidor da Intranet>
SUPABASE_URL=https://knzszyxsspdjzgqkfrdt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<segredo exclusivamente server-side>
```

No frontend Mysteptime, **apenas após teste de ponta a ponta**:

```env
VITE_MYSTEPTIME_SSO_ONLY=true
```

## O que falta antes de ativar

1. Migrar inteiramente usuários Auth, identidades, perfis, papéis, dados, Storage e funções para o Supabase de destino. Comparar contagens e executar testes de login.
2. Publicar o Mysteptime em hospedagem controlada fora do Lovable, preferencialmente sob `mysteptime.step-og.com`; configurar URL e segredos sem os expor ao cliente.
3. Obter a lista de **membros ativos do GoalFy** diretamente do provedor (administrador/API autorizada); cruzar por identidade corporativa e aprovar vínculo com STEP One.
4. Conceder `offshore:mysteptime` exclusivamente a usuários cuja elegibilidade no GoalFy foi confirmada; nunca inferir autorização por uma conta apenas no Offshore/STEP Flow.
5. Validar todos os cenários: autorização correta, identidade do mesmo usuário, papel preservado, usuário bloqueado, cadastro incompleto, ticket vencido, uso duplo e logout.
6. Configurar `MYSTEPTIME_SSO_ENABLED=true` em ambos os servidores; só depois ativar `VITE_MYSTEPTIME_SSO_ONLY=true`.
7. Rever segredos antigos do repositório público e rotacioná-los se expostos.

## Rollback

Desativar `MYSTEPTIME_SSO_ENABLED` na Intranet faz o lançador usar a URL legada. Desativar `VITE_MYSTEPTIME_SSO_ONLY` no Mysteptime reabre a autenticação normal. Esses toggles devem ser considerados independentes do banco de dados.

**Nunca remover as verificações de identidade do Supabase ou utilizar `service_role` no navegador para eliminar a tela de login.**
