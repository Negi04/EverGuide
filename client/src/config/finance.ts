import type { BudgetKind } from '@everguide/shared'

export const budgetKindLabels: Record<BudgetKind, { label: string; hint: string }> = {
  need: { label: 'Needs', hint: 'Rent, groceries, bills, transport, loan payments' },
  want: { label: 'Wants', hint: 'Eating out, shopping, subscriptions, trips' },
  saving: { label: 'Savings', hint: 'Emergency fund, investments, goals' },
}

export const EDUCATION_NOTICE =
  'For learning and planning only, not financial advice. For decisions about investments, loans or taxes, talk to a qualified adviser.'

/** Shown on AI-drafted content until a qualified person has reviewed it. */
export const GLOSSARY_LABEL = 'EverGuide starter glossary (AI-drafted, pending expert review)'

export const glossary: { term: string; definition: string }[] = [
  {
    term: 'Budget',
    definition:
      'A plan for how you’ll use your income each month: what goes to essentials, to things you enjoy, and to savings.',
  },
  {
    term: '50/30/20 rule',
    definition:
      'A rule of thumb that splits take-home income into about 50% needs, 30% wants and 20% savings. It’s a starting point, not a rule everyone can or should follow.',
  },
  {
    term: 'Emergency fund',
    definition:
      'Money set aside for unexpected costs such as a medical bill or losing your job. It’s usually kept somewhere safe and easy to access rather than invested for growth.',
  },
  {
    term: 'Inflation',
    definition:
      'The general rise in prices over time. If prices rise faster than your savings grow, your money buys less than before.',
  },
  {
    term: 'Interest',
    definition:
      'The cost of borrowing money, or the reward for lending or depositing it, usually stated as a percentage per year.',
  },
  {
    term: 'Compound interest',
    definition:
      'Interest earned on both your original amount and on interest already added. Over long periods, compounding makes a large difference.',
  },
  {
    term: 'Principal',
    definition: 'The original amount you borrow or invest, before any interest.',
  },
  {
    term: 'EMI (equated monthly instalment)',
    definition:
      'A fixed monthly payment that repays a loan over a set period. Early EMIs are mostly interest; later ones are mostly principal.',
  },
  {
    term: 'Credit score',
    definition:
      'A number lenders use to judge how reliably you repay. Paying bills and EMIs on time and keeping credit card use low tend to help it.',
  },
  {
    term: 'Fixed deposit (FD)',
    definition:
      'Money deposited with a bank for a fixed period at an agreed interest rate. Withdrawing early usually means a penalty.',
  },
  {
    term: 'Mutual fund',
    definition:
      'A pool of money from many investors, managed by professionals and invested in shares, bonds or other assets. Its value can go up or down.',
  },
  {
    term: 'NAV (net asset value)',
    definition:
      'The price of one unit of a mutual fund, calculated from the value of what it holds.',
  },
  {
    term: 'SIP (systematic investment plan)',
    definition:
      'Investing a fixed amount in a mutual fund at regular intervals, often monthly. It builds a habit and spreads purchases over time; it doesn’t guarantee returns.',
  },
  {
    term: 'Diversification',
    definition:
      'Spreading money across different kinds of investments so that one doing badly has less effect on the whole.',
  },
  {
    term: 'Risk',
    definition:
      'The chance that an investment’s value falls or doesn’t grow as hoped. Investments that can grow more usually carry more risk.',
  },
  {
    term: 'Liquidity',
    definition: 'How quickly and easily something can be turned into cash without losing value.',
  },
  {
    term: 'Net worth',
    definition: 'Everything you own (savings, investments, property) minus everything you owe.',
  },
  {
    term: 'Insurance premium',
    definition: 'The amount you pay regularly to keep an insurance policy active.',
  },
]
