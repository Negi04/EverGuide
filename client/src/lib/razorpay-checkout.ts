import type { CheckoutOrder, PaymentConfirmation } from '@everguide/shared'

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

type CheckoutSuccess = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayInstance = { open(): void }

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

let loading: Promise<void> | null = null

/** Load Razorpay's Checkout script once, only when someone starts a payment. */
export function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Couldn’t load Razorpay Checkout. Check your connection and try again.'))
    }
    document.head.append(script)
  })
  return loading
}

export class CheckoutDismissed extends Error {
  constructor() {
    super('Checkout was closed before paying.')
    this.name = 'CheckoutDismissed'
  }
}

/**
 * Open Razorpay Checkout for an order the server created. Resolves with what the
 * server needs to verify the payment; the browser itself decides nothing.
 */
export async function payWithCheckout(
  order: CheckoutOrder,
  prefill: { name?: string; email?: string },
): Promise<PaymentConfirmation> {
  await loadCheckoutScript()
  const Razorpay = window.Razorpay
  if (!Razorpay) throw new Error('Razorpay Checkout didn’t start. Please try again.')

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.razorpayOrderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: 'EverGuide',
      description: `${order.plan === 'pro' ? 'Pro' : 'Premium'} for 1 month (demo, test mode)`,
      prefill,
      theme: { color: '#0d9488' },
      handler: (response: CheckoutSuccess) =>
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new CheckoutDismissed()) },
    })
    // A failed attempt keeps Checkout open, with Razorpay's own message, so the person can retry.
    checkout.open()
  })
}
