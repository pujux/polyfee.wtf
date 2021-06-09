async function init() {
  let params = getUrlParams();
  let address = params.address || params.a || null;
  if (address === null) {
    if (
      window.hasOwnProperty("ethereum") &&
      window.ethereum.hasOwnProperty("isMetaMask")
    ) {
      let addresses = await ethereum.request({ method: "eth_requestAccounts" });
      address = addresses[0];
      console.info("Connected to", address);
    } else {
      console.info(
        "Please specify an address via ?a= or ?address= url GET parameter or sign into MetaMask."
      );
      $("body").html(`
        <p id="oops">
          Sign into 
          <strong>
            <a href="https://metamask.io">MetaMask</a>
          </strong> 
          or pass an address via the url (like <strong><a href="https://polyfee.wtf?address=0x60b0f34c4d8e024a1928645ff8b861ecdca05fbc">this</a></strong>).
        </p>`);
      return;
    }
  }
  let {
    "matic-network": { usd: maticPrice },
  } = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd"
  )
    .then((res) => res.json())
    .catch((err) => console.error("(╯°□°)╯︵ ┻━┻", err));
  if (!maticPrice) return;
  console.log("MATICUSD: $" + maticPrice);

  let key = "XN5KHF4Z412GAKSINFC74WX91U8FEFZDEU";
  let txs = [],
    txLength = 0;
  console.info(`Getting mainnet transactions for ${address}`);
  do {
    let fromBlock = txs.length > 0 ? txs[txs.length - 1].blockNumber : 0;
    let response = await fetch(
      `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=${fromBlock}&endblock=99999999&sort=asc&apikey=${key}`
    );
    if (response.ok) {
      const { result: txs2 } = await response.json();
      txLength = txs2.length;
      txs.push.apply(txs, txs2);
    } else {
      console.log("¯_(ツ)_/¯ : " + response.status);
      break;
    }
  } while (txLength === 1e4);
  const txsOut = txs
    .filter((tx) => tx.from === address.toLowerCase())
    .map(({ confirmations, ...item }) => item)
    .filter(
      (tx, i, self) =>
        self.findIndex((t) => JSON.stringify(t) === JSON.stringify(tx)) === i
    );
  console.log("Outgoing txs:", txsOut);

  $("#txOutCount").text(txsOut.length.toLocaleString("en-US"));
  const txsOutFail = txsOut.filter((tx) => tx.isError == 1);
  $("#txOutCountFail").text(txsOutFail.length.toLocaleString("en-US"));
  console.log("Failed outgoing txs:", txsOutFail);

  if (txsOut.length > 0) {
    const gasUsed = txsOut.map((tx) => parseInt(tx.gasUsed));
    const gasUsedTotal = gasUsed.reduce((a, b) => a + b, 0);
    const gasPrices = txsOut.map((tx) => parseInt(tx.gasPrice));
    const minMaxPrices = [Math.min(...gasPrices), Math.max(...gasPrices)];
    const gasFeeTotal = gasPrices
      .map((price, i) => price * gasUsed[i])
      .reduce((a, b) => a + b, 0);
    const gasPriceTotal = gasPrices.reduce((a, b) => a + b, 0);

    const gasUsedFail = txsOutFail.map((tx) => parseInt(tx.gasUsed));
    const gasPricesFail = txsOutFail.map((tx) => parseInt(tx.gasPrice));
    const gasFeeTotalFail = gasPricesFail
      .map((price, i) => price * gasUsedFail[i])
      .reduce((a, b) => a + b, 0);

    $("#gasUsedTotal").text(
      gasUsedTotal > 999999
        ? `${(gasUsedTotal / 1e6).toFixed(3)} million`
        : gasUsedTotal.toLocaleString("en-US", { maximumFractionDigits: 5 })
    );
    $("#gasPricePerTx").text((gasPriceTotal / txsOut.length / 1e9).toFixed(1));
    $("#gasFeeTotal").text(`${(gasFeeTotal / 1e18).toFixed(5)} MATIC`);
    $("#gasFeeTotalFail").text(
      txsOutFail.length > 0
        ? `${(gasFeeTotalFail / 1e18).toFixed(5)} MATIC`
        : "nothing"
    );
    if (maticPrice) {
      const feePrice = (maticPrice * gasFeeTotal) / 1e16;
      const failFeePrice = (maticPrice * gasFeeTotalFail) / 1e16
      $("#dollarFeePrice").text(
        gasFeeTotal === 0
          ? "nothing"
          : `${feePrice > 100 ? `$ ${(feePrice / 100).toFixed(2)}` : `${feePrice.toFixed(2)} cents`}`
      );
      $("#dollarFeeFailedPrice").text(
        gasFeeTotalFail === 0
          ? "nothing"
          : `${failFeePrice > 100 ? `$ ${(failFeePrice / 100).toFixed(2)}` : `${failFeePrice.toFixed(2)} cents`}`
      );
    }
  } else {
    $("#gasUsedTotal").text(0);
    $("#gasPricePerTx").text(0);
    $("#gasFeeTotal").text("nothing");
    $("#gasFeeTotalFail").text("nothing");
    $("#dollarFeePrice").text("nothing");
    $("#dollarFeeFailedPrice").text("nothing");
  }
}

function getUrlParams() {
  if (location.search)
    return JSON.parse(
      '{"' +
        location.search.substring(1).replace(/&/g, '","').replace(/=/g, '":"') +
        '"}',
      (key, value) => (key === "" ? value : decodeURIComponent(value))
    );
  else return {};
}

async function tip(amount) {
  if (
    window.hasOwnProperty("ethereum") &&
    window.ethereum.hasOwnProperty("isMetaMask")
  ) {
    ethereum
      .request({
        method: "eth_sendTransaction",
        params: [
          {
            from: ethereum.selectedAddress,
            to: "0x60CDac3cd0Ba3445D776B31B46E34623723C6482",
            value: (amount * 1e18).toString(16),
          },
        ],
      })
      .then((txHash) => {
        console.log(txHash);
      })
      .catch((err) => {
        console.error(err);
      });
  } else {
    return alert(
      "Install MetaMask to use this cool feature. https://metamask.io"
    );
  }
}

$(document).on("click", "#tinytip", function (e) {
  tip("0.001");
  e.preventDefault();
});

$(document).on("click", "#smalltip", function (e) {
  tip("0.01");
  e.preventDefault();
});

$(document).on("click", "#bigtip", function (e) {
  tip("0.1");
  e.preventDefault();
});

$(document).on("click", "#hugetip", function (e) {
  tip("1");
  e.preventDefault();
});
