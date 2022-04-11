
// Test server on cloud
export const BASE_PATH = 'https://performance-test.kb.us-central1.gcp.cloud.es.io:9243/';

// Spencers off cloud instance
//export const BASE_PATH = 'http://34.136.67.157';


const BUNDLE_ID = '50609';
const DEFAULT_HEADERS = {
    // "accept-encoding": "identity",
    "content-type": "application/json",
    "Connection": "keep-alive",
    "kbn-version": "8.1.1",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin"
}

const USERNAME = 'benchmark';
const PASSWORD = 'markymark';

export const TEST_FILES = {
    'cdn-file': {
        url: 'https://tools-7.kxcdn.com/js/perf-4ca7c62e7b.js',
        method: 'GET',
    },
    'other-server-js-file': {
        // Mock express server
        url: 'https://node-perf-baseline.kibana.dev/assets/bundle.js',
        method: 'GET',
    },
    'json': {
        url:'/translations/en.json', 
        method: 'GET',
    },
    'css-theme': {
        url: '/ui/legacy_light_theme.css',
        method: 'GET',
    },
    'small-chunk': {
        url: `/${BUNDLE_ID}//bundles/kbn-ui-shared-deps-npm/kbn-ui-shared-deps-npm.chunk.2.js`,
        method: 'GET',
    },
    'data-plugin': {
        url: `/${BUNDLE_ID}/bundles/plugin/data/kibana/data.plugin.js`,
        auth: false,
        method: 'GET',
        params: {},
    },
    'utils-plugin': {
        url: `/${BUNDLE_ID}/bundles/plugin/kibanaUtils/kibana/kibanaUtils.plugin.js`,
        auth: false,
        method: 'GET',
        params: {},
    },
    'shared-dll':{
        url: `/${BUNDLE_ID}/bundles/kbn-ui-shared-deps-npm/kbn-ui-shared-deps-npm.dll.js`,
        method: 'GET',
    },
    'login-state': {
        url: '/internal/security/login_state',
        auth: false,
        method: 'GET',
        params: {},
    },
    login: {
        url: '/internal/security/login',
        auth: false,
        method: 'POST',
        headers: DEFAULT_HEADERS,
        params: {
            providerType: "basic",
            providerName: "basic",
            currentURL: `${BASE_PATH}/login`,
            params: {
                username: USERNAME,
                password: PASSWORD,
            },
        },
    },
    'simple-search': {
        auth: true,
        method: 'POST',
        url: '/api/console/proxy?path=kibana_sample_data_flights%2F_search&method=GET',
        headers: {
            ...DEFAULT_HEADERS,
            'kbn-xsrf': 'kibana',
        },
        params: {
            "aggs": {
                "0": {
                    "cardinality": {
                        "field": "Carrier"
                    }
                }
            },
            "size": 0
        }

    }
}