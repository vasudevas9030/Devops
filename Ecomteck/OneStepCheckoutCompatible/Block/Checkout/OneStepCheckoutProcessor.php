<?php
/**
 * Ecomteck
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Ecomteck.com license that is
 * available through the world-wide-web at this URL:
 * https://ecomteck.com/LICENSE.txt
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade this extension to newer
 * version in the future.
 *
 * @category    Ecomteck
 * @package     Ecomteck_OneStepCheckoutCompatible
 * @copyright   Copyright (c) 2018 Ecomteck (https://ecomteck.com/)
 * @license     https://ecomteck.com/LICENSE.txt
 */
namespace Ecomteck\OneStepCheckoutCompatible\Block\Checkout;

use Magento\Checkout\Block\Checkout\LayoutProcessorInterface;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;
use \Magento\Framework\Module\Manager as ModuleManager;
use Magento\Customer\Model\AttributeMetadataDataProvider;
use Magento\Ui\Component\Form\AttributeMapper;
use Magento\Checkout\Block\Checkout\AttributeMerger;
use Magento\Checkout\Model\Session as CheckoutSession;
use Magento\Framework\Stdlib\ArrayManager;

class OneStepCheckoutProcessor implements LayoutProcessorInterface
{
    const CONFIG_ENABLE_MAGEWORX_MULTIFEES = 'mageworx_multifees/main/enable_cart';
    const CONFIG_ENABLE_AMASTY_SHIPPING_TABLES = 'carriers/amstrates/active';
    const CONFIG_ENABLE_MAGEPLAZA_SOCIALLOGIN = 'sociallogin/general/enabled';

    /**
     * @var ScopeConfigInterface
     */
    private $scopeConfig;

    /**
     * @var ModuleManager
     */
    private $moduleManager;

    /**
     * @var CheckoutSession
     */
    public $checkoutSession;

    /**
     * @var null
     */
    public $quote = null;

    /**
     * One step checkout helper
     *
     * @var \Ecomteck\OneStepCheckout\Helper\Config
     */
    protected $_config;

    protected $request;

    protected $_moduleList;

    /**
     * Declare the ArrayManager property
     *
     * @var ArrayManager
     */
    protected $arrayManager;

    /**
     * @param ScopeConfigInterface $scopeConfig
     * @param ModuleManager $moduleManager
     * @param CheckoutSession $checkoutSession
     * @param \Ecomteck\OneStepCheckout\Helper\Config $config
     * @param \Magento\Framework\App\Request\Http $request
     * @param ArrayManager $arrayManager
     * @param \Magento\Framework\Module\ModuleListInterface $moduleList
     */
    public function __construct(
        ScopeConfigInterface $scopeConfig, 
        ModuleManager $moduleManager,
        CheckoutSession $checkoutSession,
        \Ecomteck\OneStepCheckout\Helper\Config $config,
        \Magento\Framework\App\Request\Http $request,
        ArrayManager $arrayManager,
        \Magento\Framework\Module\ModuleListInterface $moduleList
    ) {
        $this->scopeConfig = $scopeConfig;
        $this->moduleManager = $moduleManager;
        $this->checkoutSession = $checkoutSession;
        $this->arrayManager = $arrayManager; // Initialize the array manager
        $this->_config = $config;
        $this->request = $request;
        $this->_moduleList = $moduleList;
    }

    /**
     * Check if the module is installed on Magento 2 site or not
     * @param string $moduleName
     * @return boolean
     */
    public function checkModuleInstalled($moduleName) {
        $is_installed =  $this->_moduleList->has($moduleName);
        if ($is_installed) {
            if (!$this->moduleManager->isOutputEnabled($moduleName)) {
                $is_installed = false;
            }
        }

        return $is_installed;
    }

    /**
     * Changes cart items to be above totals in the cart summary.
     *
     * @param array $jsLayout
     * @return array
     */
    private function modifyMageWorxMultiFees($jsLayout) {
        if (!$this->checkModuleInstalled("MageWorx_MultiFees")) {
            return $jsLayout;
        }
        if ($this->scopeConfig->getValue(self::CONFIG_ENABLE_MAGEWORX_MULTIFEES, ScopeInterface::SCOPE_STORE)) {
            $path = 'components/checkout/children/steps/children/shipping-step/children/shippingAddress/children/shippingAdditional/children/mageworx-shipping-fee-form-container';
            if ($this->arrayManager->get($path, $jsLayout)) {
                $jsLayout = $this->arrayManager->set($path.'/component', $jsLayout, 'Ecomteck_OneStepCheckoutCompatible/js/MageWorx/MultiFees/view/shipping-fee');
            }
        }
        return $jsLayout;
    }

    /**
     * Changes cart items to be above totals in the cart summary.
     *
     * @param array $jsLayout
     * @return array
     */
    private function modifyAmastyShippingTableRates($jsLayout) {
        if (!$this->checkModuleInstalled("Amasty_ShippingTableRates")) {
            return $jsLayout;
        }
        if ($this->scopeConfig->getValue(self::CONFIG_ENABLE_AMASTY_SHIPPING_TABLES, ScopeInterface::SCOPE_STORE)) {
            $jsLayout['components']['checkout']['children']['steps']['children']['shipping-step']
            ['children']['shippingAddress']['template'] = 'Ecomteck_OneStepCheckoutCompatible/Amasty/ShippingTableRates/template/shipping';
        }
        return $jsLayout;
    }

    /**
     * Override Mageplaza social login to display social login on checkout page
     *
     * @param array $jsLayout
     * @return array
     */
    private function modifyMageplazaSocialLogin($jsLayout) {
        if (!$this->checkModuleInstalled("Mageplaza_SocialLogin")) {
            return $jsLayout;
        }
        if ($this->scopeConfig->getValue(self::CONFIG_ENABLE_MAGEPLAZA_SOCIALLOGIN, ScopeInterface::SCOPE_STORE)) {
            $path = 'components/checkout/children/steps/children/shipping-step/children/shippingAddress/children/social-login';
            $jsLayout = $this->arrayManager->set($path.'/component', $jsLayout, 'Ecomteck_OneStepCheckoutCompatible/js/Mageplaza/SocialLogin/view/social-buttons');
            $jsLayout = $this->arrayManager->set($path.'/displayArea', $jsLayout, 'social-login');
        }
        return $jsLayout;
    }

    /**
     * {@inheritdoc}
     */
    public function process($jsLayout) {
        if (!$this->_config->isEnabled()) {
            return $jsLayout;
        }

        $jsLayout = $this->modifyMageWorxMultiFees($jsLayout);
        $jsLayout = $this->modifyAmastyShippingTableRates($jsLayout);
        $jsLayout = $this->modifyMageplazaSocialLogin($jsLayout);
        
        return $jsLayout;
    }
}
