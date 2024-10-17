/**
 * Copyright © 2017 Ecomteck. All rights reserved.
 * See LICENSE.txt for license details.
 */
define([
    'ko',
    'Magento_Customer/js/model/customer',
    'Magento_Checkout/js/model/address-converter',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/action/select-shipping-address',
    'Magento_Checkout/js/model/shipping-save-processor/default',
    'Magento_Checkout/js/action/create-billing-address',
    'Magento_Checkout/js/action/select-billing-address',
    'Magento_Checkout/js/action/get-payment-information',
    'Magento_Customer/js/model/address-list',
    'mage/translate',
    'jquery',
    'Ecomteck_OneStepCheckout/js/jquery/garlic.min'
], function (
    ko,
    customer,
    addressConverter,
    quote,
    selectShippingAddress,
    shippingSaveProcessor,
    createBillingAddress,
    selectBillingAddress,
    getPaymentInformation,
    addressList,
    $t,
    $
) {
    'use strict';

    return function (target) {
        if (typeof(window.checkoutConfig.onestepcheckout) == 'undefined') {
            return target.extend({});
        }
        return target.extend({
            /**
             * Override shipping template so we can hide rates when there's only 1 available.
             */
            defaults: {
                template: 'Ecomteck_OneStepCheckout/shipping',
                shippingFormTemplate: 'Magento_Checkout/shipping-address/form',
                shippingMethodListTemplate: 'Ecomteck_OneStepCheckout/shipping-address/shipping-method-list',
                shippingMethodItemTemplate: 'Ecomteck_OneStepCheckout/shipping-address/shipping-method-item'
            },

            /**
             * Disable visibility on shipping, since it's no longer the first step.
             */
            //visible: ko.observable(customer.isLoggedIn() && !quote.isVirtual()),
            visibleAccountInformation: ko.observable(!customer.isLoggedIn()),
            canUseBillingAddress: ko.observable(true),
            isAddressSameAsBilling: ko.observable(!window.checkoutConfig.onestepcheckout.uncheckBillingAddressIsSameShippingAddress),
            quoteIsVirtual: ko.observable(quote.isVirtual()),
            initialize: function () {
                this._super();
                var selectedShippingMethod = window.checkoutConfig.selectedShippingMethod;
                if (selectedShippingMethod) {
                    this.selectShippingMethod(selectedShippingMethod);
                }

                getPaymentInformation();

                if (window.checkoutConfig.onestepcheckout.autoComplete.autoSaveFillCustomerInfo) {
                    $('.form-login').garlic({
                        onRetrieve: function ( elem, retrievedValue ) {
                            $(elem).change();
                        }
                    });
                    $('#co-shipping-form').garlic({
                        onRetrieve: function ( elem, retrievedValue ) {
                            $(elem).change();
                        }
                    });
                }
                var self = this;
                this.isAddressSameAsBilling.subscribe(function (value) {
                    if (value) {
                        self.useBillingForShipping();
                    } else {
                        self.useShippingForShipping();
                    }
                });
                if (this.isBillingBeforeShipping()) {
                    window.timeCheckBillingFormExist = setInterval(function () {
                        if ($('#billing-new-address-form').find('input,select').length) {
                            $('#billing-new-address-form').find('input,select').change(function () {
                                if (self.isAddressSameAsBilling()) {
                                    self.useBillingForShipping();
                                }
                            });
                            clearInterval(window.timeCheckBillingFormExist);
                        }
                    },1000)
                }
            },

            useBillingForShipping : function () {
                var self = this;
                var shippingAddress = quote.shippingAddress();
                var addressData = addressConverter.formAddressDataToQuoteAddress(
                    self.source.get('billingAddress')
                );

                //Copy form data to quote shipping address object
                for (var field in addressData) {
                    if (addressData.hasOwnProperty(field) && //eslint-disable-line max-depth
                        shippingAddress.hasOwnProperty(field) &&
                        typeof addressData[field] != 'function' &&
                        _.isEqual(shippingAddress[field], addressData[field])
                    ) {
                        shippingAddress[field] = addressData[field];
                    } else if (typeof addressData[field] != 'function' &&
                        !_.isEqual(shippingAddress[field], addressData[field])) {
                        shippingAddress = addressData;
                        break;
                    }
                }
                selectShippingAddress(shippingAddress);
            },
            useShippingForShipping : function () {
                var self = this;
                var shippingAddress = quote.shippingAddress();
                var addressData = addressConverter.formAddressDataToQuoteAddress(
                    self.source.get('shippingAddress')
                );

                //Copy form data to quote shipping address object
                for (var field in addressData) {
                    if (addressData.hasOwnProperty(field) && //eslint-disable-line max-depth
                        shippingAddress.hasOwnProperty(field) &&
                        typeof addressData[field] != 'function' &&
                        _.isEqual(shippingAddress[field], addressData[field])
                    ) {
                        shippingAddress[field] = addressData[field];
                    } else if (typeof addressData[field] != 'function' &&
                        !_.isEqual(shippingAddress[field], addressData[field])) {
                        shippingAddress = addressData;
                        break;
                    }
                }
                selectShippingAddress(shippingAddress);
            },

            shouldHideShipping: function () {
                return window.checkoutConfig.onestepcheckout.hideShippingMethods && this.rates().length === 1;
            },

            isBillingBeforeShipping: function () {
                return window.checkoutConfig.onestepcheckout.moveBillingAddressBeforeShippingAddressEnabled;
            },


            /**
             * These steps don't set itself to visible on refresh.
             */
            navigate: function () {
                this.visible(true);
            },

            /**
             * Removed email validation as we do that in a previous step.
             */
            validateShippingInformation: function () {
                var validateResult=true,
                        shippingAddress,
                        addressData,
                        loginFormSelector = 'form[data-role=email-with-possible-login]',
                        emailValidationResult = customer.isLoggedIn(),
                        field;
                if (!quote.shippingMethod()) {
                    this.errorValidationMessage($t('Please specify a shipping method.'));

                    validateResult = validateResult && false;
                }

                if (!customer.isLoggedIn()) {
                    $(loginFormSelector).validation();
                    emailValidationResult = Boolean($(loginFormSelector + ' input[name=username]').valid());
                }
                if (!this.isBillingBeforeShipping() || !$('[name="shipping-address-same-as-billing"]').is(":checked")) {
                    if (this.isFormInline) {
                        this.source.set('params.invalid', false);

                        if (typeof this.triggerShippingDataValidateEvent !== 'undefined') {
                            this.triggerShippingDataValidateEvent();
                        }

                        if (this.source.get('params.invalid')) {
                            this.focusInvalid();
                            validateResult = validateResult && false;
                        }

                        shippingAddress = quote.shippingAddress();
                        addressData = addressConverter.formAddressDataToQuoteAddress(
                            this.source.get('shippingAddress')
                        );

                        //Copy form data to quote shipping address object
                        for (field in addressData) {
                            if (addressData.hasOwnProperty(field) && //eslint-disable-line max-depth
                                shippingAddress.hasOwnProperty(field) &&
                                typeof addressData[field] != 'function' &&
                                _.isEqual(shippingAddress[field], addressData[field])
                            ) {
                                shippingAddress[field] = addressData[field];
                            } else if (typeof addressData[field] != 'function' &&
                                !_.isEqual(shippingAddress[field], addressData[field])) {
                                shippingAddress = addressData;
                                break;
                            }
                        }

                        if (customer.isLoggedIn()) {
                            shippingAddress['save_in_address_book'] = 1;
                        }
                        selectShippingAddress(shippingAddress);
                    }

                }

                if (!emailValidationResult) {
                    $(loginFormSelector + ' input[name=username]').focus();

                    validateResult = validateResult && false;
                }

                if (!this.source.get('params.invalid') && !quote.shippingMethod()) {
                    $('html, body').animate({
                        scrollTop: $("#co-shipping-method-form").offset().top
                    }, 0);
                }
                return validateResult;
            },
            /**
             * @param {Object} shippingMethod
             * @return {Boolean}
             */
            selectShippingMethod: function (shippingMethod) {
                this._super(shippingMethod);
                shippingSaveProcessor.saveShippingInformation();
                return true;
            },

            validateBillingInformation: function () {
                var validateResult=true,
                        loginFormSelector = 'form[data-role=email-with-possible-login]',
                        emailValidationResult = customer.isLoggedIn();
                if (!quote.shippingMethod()) {
                    this.errorValidationMessage($t('Please specify a shipping method.'));

                    validateResult = validateResult && false;
                }

                if (!customer.isLoggedIn()) {
                    $(loginFormSelector).validation();
                    emailValidationResult = Boolean($(loginFormSelector + ' input[name=username]').valid());
                }
                if (!emailValidationResult) {
                    $(loginFormSelector + ' input[name=username]').focus();
                    validateResult = validateResult && false;
                }

                if ($('[name="billing-address-same-as-shipping"]').is(":checked") && !this.isBillingBeforeShipping()) {
                    selectBillingAddress(quote.shippingAddress());
                    validateResult = validateResult && true;
                    $(".checkout-billing-address > .fieldset").hide();
                } else {
                    var selectedAddress = $('[name="billing_address_id"]').val();
                    if (selectedAddress) {
                        var res = addressList.some(function (addressFromList) {
                            if (selectedAddress == addressFromList.customerAddressId) {
                                selectBillingAddress(addressFromList);
                                return true;
                            }
                            return false;
                        });

                        validateResult = validateResult && res;
                    } else {
                        this.source.set('params.invalid', false);
                        this.source.trigger('billingAddress.data.validate');

                        if (this.source.get('params.invalid')) {
                            validateResult = validateResult && false;
                        }
                        var addressData = this.source.get('billingAddress'),
                        newBillingAddress;
                        if ($('#billing-save-in-address-book').is(":checked")) {
                            addressData.save_in_address_book = 1;
                        }

                        newBillingAddress = createBillingAddress(addressData);
                        selectBillingAddress(newBillingAddress);
                    }

                    validateResult = validateResult && true;
                }
                return validateResult;
            }
        });
    }
});
