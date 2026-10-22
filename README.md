# Agenda das casas

App operacional do grupo (Downtown, Don Under Pub e Calçada Street Bar). A primeira parte é a agenda de eventos:

- Calendário do mês com o nome de cada evento escrito no dia, uma cor por casa.
- Abas: Visão geral, Downtown, Don Under Pub e Calçada (as duas unidades).
- Clique no dia para ver os eventos daquela data e adicionar um novo.
- Ficha do evento: casas (uma ou mais, para festas conjuntas), local, status, tipo, horário, atrações com cachê, entrada, promoção, informações para arte e observações. Dá para editar, duplicar e apagar.
- Feriados nacionais calculados automaticamente para qualquer ano (inclusive Carnaval, Sexta-feira Santa e Corpus Christi), mais o aniversário de Blumenau (2/9).
- Feriados locais, datas comerciais e eventos da cidade (Oktoberfest, shows) são marcados pela equipe no próprio app.
- Login individual por funcionário.

## Rodar no computador

```bash
npm install
npm run dev
```

## Perfis

- **Gestão**: vê e edita tudo, inclusive cachês e valores.
- **Produção**: vê a agenda, os eventos, as atrações e o Material, baixa as imagens, copia o briefing e marca "em produção". Não vê valores e não edita eventos. A regra fica no banco, não só na tela.

Sem configurar o Supabase, o app abre em **modo demonstração**: qualquer e-mail entra e os dados ficam só naquele navegador.

## Ligar o banco de dados (Supabase)

1. Crie uma conta e um projeto em https://supabase.com.
2. No projeto, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Nas configurações de **Authentication**, desative o cadastro público de novos usuários, para que só o administrador crie contas.
4. Em **Authentication > Users**, crie um usuário para cada funcionário (e-mail e senha). Toda conta nova entra como **Produção**.
5. Para dar acesso de **Gestão** a alguém, rode no SQL Editor (trocando o e-mail):
   `update perfis set papel = 'gestao' where id = (select id from auth.users where email = 'fulano@exemplo.com');`
6. Copie `.env.example` para `.env` e preencha com a URL e a chave `anon` do projeto.

## Outros comandos

- `npm test`: testa o cálculo dos feriados.
- `npm run build`: gera a versão para publicar (pasta `dist`).
- `npm run build:demo`: gera um único arquivo HTML em modo demonstração (pasta `dist-demo`).
