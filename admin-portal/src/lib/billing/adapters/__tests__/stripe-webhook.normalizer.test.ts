/**
 * Tests for Stripe webhook normalizer
 */

import { StripeWebhookNormalizer } from '../stripe-webhook.normalizer';
import Stripe from 'stripe';

describe('StripeWebhookNormalizer', () => {
  let normalizer: StripeWebhookNormalizer;

  beforeEach(() => {
    normalizer = new StripeWebhookNormalizer('sk_test_xxx');
  });

  describe('checkout session handling', () => {
    it('should extract quantity from checkout session', () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_xxx',
        mode: 'subscription',
        subscription: 'sub_xxx',
        customer: 'cus_xxx',
        payment_status: 'paid',
        metadata: {
          user_id: 'user-123',
          plan_id: 'plan_pro_month',
          quantity: '5',
        },
      };

      const event: Partial<Stripe.Event> = {
        id: 'evt_xxx',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        data: {
          object: checkoutSession as Stripe.Checkout.Session,
        },
      };

      const normalized = normalizer.normalize(event as Stripe.Event);

      expect(normalized).not.toBeNull();
      expect(normalized?.data).toHaveProperty('quantity', 5);
      expect(normalized?.data).toHaveProperty('subscriptionId', 'sub_xxx');
      expect(normalized?.data).toHaveProperty('planId', 'plan_pro_month');
    });

    it('should set status to active when payment_status is paid', () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_xxx',
        mode: 'subscription',
        subscription: 'sub_xxx',
        customer: 'cus_xxx',
        payment_status: 'paid',
        metadata: {
          user_id: 'user-123',
          plan_id: 'plan_pro_month',
        },
      };

      const event: Partial<Stripe.Event> = {
        id: 'evt_xxx',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        data: {
          object: checkoutSession as Stripe.Checkout.Session,
        },
      };

      const normalized = normalizer.normalize(event as Stripe.Event);

      expect(normalized?.data).toHaveProperty('status', 'active');
    });

    it('should set status to incomplete when payment_status is not paid', () => {
      const checkoutSession: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_xxx',
        mode: 'subscription',
        subscription: 'sub_xxx',
        customer: 'cus_xxx',
        payment_status: 'unpaid',
        metadata: {
          user_id: 'user-123',
          plan_id: 'plan_pro_month',
        },
      };

      const event: Partial<Stripe.Event> = {
        id: 'evt_xxx',
        type: 'checkout.session.completed',
        created: Date.now() / 1000,
        data: {
          object: checkoutSession as Stripe.Checkout.Session,
        },
      };

      const normalized = normalizer.normalize(event as Stripe.Event);

      expect(normalized?.data).toHaveProperty('status', 'incomplete');
    });
  });

  describe('subscription events', () => {
    it('should extract quantity from subscription', () => {
      const subscription: Partial<Stripe.Subscription> = {
        id: 'sub_xxx',
        customer: 'cus_xxx',
        status: 'active',
        items: {
          data: [
            {
              id: 'si_xxx',
              quantity: 10,
              price: {
                id: 'price_xxx',
              } as Stripe.Price,
            } as Stripe.SubscriptionItem,
          ],
        } as Stripe.ApiList<Stripe.SubscriptionItem>,
        current_period_start: Date.now() / 1000,
        current_period_end: Date.now() / 1000 + 2592000,
        metadata: {
          user_id: 'user-123',
          plan_id: 'plan_pro_month',
        },
      };

      const event: Partial<Stripe.Event> = {
        id: 'evt_xxx',
        type: 'customer.subscription.updated',
        created: Date.now() / 1000,
        data: {
          object: subscription as Stripe.Subscription,
        },
      };

      const normalized = normalizer.normalize(event as Stripe.Event);

      expect(normalized).not.toBeNull();
      expect(normalized?.data).toHaveProperty('quantity', 10);
      expect(normalized?.data).toHaveProperty('status', 'active');
    });
  });
});
