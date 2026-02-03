const origFetch = global.fetch;

global.fetch = async (...args) => {
  const url = args[0];
  const u = typeof url === "string" ? url : url?.toString?.();
  console.log("\n[BUILD FETCH]", u);
  console.log(new Error("fetch stack").stack);
  return origFetch(...args);
};
