const ckanUrl = 'https://open.alberta.ca';
const proxyUrl = `${ckanUrl}/api/3/action/package_search?q=*:*&rows=1000&start=0`;

async function testFetch() {
    console.log("Fetching: " + proxyUrl);
    const start = Date.now();
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const time = Date.now() - start;
        console.log(`Time: ${time}ms`);
        console.log(`Success: ${data.success}`);
        if(data.success) {
             console.log(`Total count: ${data.result.count}`);
             console.log(`Returned packages: ${data.result.results.length}`);
        }
    } catch(e) {
        console.error(e);
    }
}
testFetch();
