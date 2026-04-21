async function run() {
  const r = await fetch('https://open.alberta.ca/api/3/action/package_list');
  const d = await r.json();
  console.log(d.result.length);
}
run();
