import { TEST_FILES, BASE_PATH } from './test-data.js';
import axios from 'axios';

const INTERVAL_LENGTH_MINS = 0.5;
const REQUESTS_PER_BATCH = 10;
const LATENCY_MAX_FACTOR = 200;
const TEST_RPMS = [200, 500, 1000, 3000, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 40000, 50000];

const TOP_LEVEL_TIMEOUT = 'top level timeout';

/**
 * Use axios middleware to calculate response duration
 */
axios.interceptors.request.use(function (config) {
    config.metadata = { startTime: new Date() }
    return config;
}, function (error) {
    return Promise.reject(error);
});

axios.interceptors.response.use(function (response) {
    response.config.metadata.endTime = new Date()
    response.duration = response.config.metadata.endTime - response.config.metadata.startTime
    return response;
}, function (error) {
    if (error.config && error.config.metadata) {
        error.config.metadata.endTime = new Date();
        error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
    }
    return Promise.reject(error);
});

async function doLogin() {
    console.log('logging in...')
    const configObject = TEST_FILES['login'];
    const reqObj = {
        baseURL: BASE_PATH,
        method: configObject.method,
        url: configObject.url,
        headers: configObject.headers || {},
        data: JSON.stringify(configObject.params || {}),
    };

    const loginRes = await axios.request(reqObj);
    const cookie = loginRes.headers['set-cookie'][0].split(';')[0];
    console.log(`logged in!`)
    return cookie;
}

function getRequestPromise(configObject, abortController) {
    const headers = {
        ...configObject.headers || {},
    };

    const reqObj = {
        rejectUnauthorized: false,
        baseURL: BASE_PATH,
        method: configObject.method,
        url: configObject.url,
        signal: abortController.signal,
        headers,
        ...(configObject.method === 'GET' ? {
            params: configObject.params || {},
        } : {
            data: JSON.stringify(configObject.params || {}),
        })
    };

    // console.log(reqObj)

    return axios.request(reqObj).then(r => {
        // console.log(r)
        const { status, duration } = r;
        return {
            status,
            duration,
        }
    }).catch(e => {
        // console.log(e)
        return {
            status: e.response?.status,
            duration: e.duration,
        }
    });
}

/**
 * Awaits a list of promises and formats them into an object with average execution times per staus code
 * @param {*} responses 
 * @returns 
 */
async function getStatusCodesFromResponses(timingsPromises) {
    const responses = await Promise.all(timingsPromises);

    let statusCodes = {}
    responses.map(r => {
        if (!statusCodes[r.status]) {
            statusCodes[r.status] = {
                count: 0,
                totalTime: 0,
                avg: 0,
            }
        }

        statusCodes[r.status].count++;
        statusCodes[r.status].totalTime += r.duration;
    });

    Object.keys(statusCodes).forEach(key => {
        statusCodes[key].avg = statusCodes[key].totalTime / statusCodes[key].count
    });

    return statusCodes;
}

/**
 * 
 * @param {*} rpm 
 * @param {*} configObject 
 * @throws A TOP_LEVEL_TIMEOUT error if responses didn't return within INTERVAL_LENGTH_MINS * LATENCY_MAX_FACTOR 
 * @returns An object with average response times per status code
 */
function runIntervalsForDuration(rpm, configObject) {
    // target requests per second
    const rps = rpm / 60;
    // interval duration in seconds
    const intervalDurationSec = REQUESTS_PER_BATCH / rps;
    // Overall number of requests to run
    const requestsToRun = INTERVAL_LENGTH_MINS * rpm;
    // console.log(`batch ${REQUESTS_PER_BATCH}, rpm ${rpm}, interval duration ${intervalDurationSec}`);
    return new Promise(async (resolve, reject) => {
        let intervalCount = 0;
        const timingsPromises = [];
        const abortControllers = [];
        let intervalHandle = undefined;

        const intervalHandler = async () => {
            process.stdout.write(`Interval ${intervalCount}: ${Math.floor(intervalCount * intervalDurationSec* 10) / 10}s, ${REQUESTS_PER_BATCH*intervalCount} requests\r`);
            intervalCount++;

            for (let i = 0; i < REQUESTS_PER_BATCH; i++) {
                const abortController = new AbortController();
                abortControllers.push(abortController);
                timingsPromises.push(getRequestPromise(configObject, abortController));
            }

            if (timingsPromises.length >= requestsToRun) {
                process.stdout.write(`\n`);
                intervalHandle && clearInterval(intervalHandle);

                // setup a timer to abort after 60 seconds
                const abortTimeoutHandler = setTimeout(() => {
                    console.error('GLOBAL TIMEOUT')
                    abortControllers.map(abortController => abortController.abort());
                    // reject(new Error(TOP_LEVEL_TIMEOUT));
                },
                    60 * 1000
                );

                const res = await getStatusCodesFromResponses(timingsPromises);

                // clear the abort timer if all have returned
                clearTimeout(abortTimeoutHandler);
                resolve(res);
            } else if (!intervalHandle) {
                intervalHandle = setInterval(intervalHandler, intervalDurationSec * 1000);                
            }
        };

        intervalHandler();
    })
}

/**
 * Logs result table
 * @param {*} benchmarks 
 */
function showTable(benchmarks) {
    const keys = Object.keys(benchmarks);
    const tableData = [];
    keys.forEach(rpm => {
        const statusCodes = Object.keys(benchmarks[rpm]);
        statusCodes.forEach(statusCode => {
            const b = benchmarks[rpm][statusCode];
            tableData.push({
                rpm,
                statusCode,
                'total time': b.totalTime,
                'total runs': b.count,
                'avg runtime': b.avg,
            });
        })
    })

    console.table(tableData)
}

/**
 * Run test
 */
async function initTest(testName = 'login') {
    const testData = TEST_FILES[testName];
    if (!testData) {
        console.error(`Unknown test ${testName}`)
        return;
    }
    console.log(`Test fetching ${testData.url}`)
    const benchmarks = {};
    let i = 0;
    let rpm = TEST_RPMS[i++];
    let latestBenchMark = undefined;
    let errorBreak = false;

    
    // login if needed
    if (testData.auth) {
        let authCookie = await doLogin();
        testData.headers = testData.headers || {};
        testData.headers.cookie = authCookie.trim();
    }

    // warm up
    console.log('Doing warm up')
    await runIntervalsForDuration(100, testData);

    do {
        try {
            console.log(`Running test for ${rpm} rpm, interval duration is ${INTERVAL_LENGTH_MINS} mins`)
            latestBenchMark = benchmarks[rpm] = await runIntervalsForDuration(rpm, testData);
            console.log(`${rpm} rpm, ${latestBenchMark[200].avg} ms`)
            rpm = TEST_RPMS[i++];
            if (!rpm) {
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            if (e.message === TOP_LEVEL_TIMEOUT) {
                errorBreak = true;
                console.error(`Timeout at ${rpm}`)
                break;
            }
        }
    } while (
        // Top level timeout
        !errorBreak && 
        // The initial batch failed 
        benchmarks[TEST_RPMS[0]][200] !== undefined && 
        // The last benchmark had any successful responses
        latestBenchMark[200] && 
        // Latency increased by LATENCY_MAX_FACTOR
        (latestBenchMark[200].avg / LATENCY_MAX_FACTOR < benchmarks[TEST_RPMS[0]][200].avg))

    showTable(benchmarks);
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
const testName = process.argv[2];
initTest(testName);