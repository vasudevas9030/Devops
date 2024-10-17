/**
 * Copyright © 2017 Ecomteck. All rights reserved.
 * See LICENSE.txt for license details.
 */
define(
    [
        'ko',
        'Magento_Checkout/js/model/quote',
        'Magento_Customer/js/model/customer'
    ],
    function (ko, quote, customer) {
        'use strict';

        /**
         * Disable visibility on billing, since it's no longer the first step.
         */
        return function (target) {
            if (typeof(window.checkoutConfig.onestepcheckout) == 'undefined') {
                return target.extend({});
            }
            return target.extend({
                defaults: {
                    template: 'Ecomteck_OneStepCheckout/payment',
                    activeMethod: ''
                },

                isVisible: ko.observable(customer.isLoggedIn() && quote.isVirtual())
            });
        };
    }
);