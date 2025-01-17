import React, { useState } from "react"

import algosdk from "algosdk"

import { Typography, Button, TextField, Slider, Grid } from "@mui/material"

import { PieChart, Pie, Tooltip, ResponsiveContainer, Link } from 'recharts';

import { useWallet } from '@txnlab/use-wallet'

import { useRouter } from 'next/router'




export default function Proposal(props) {

  const { activeAccount, signTransactions, sendTransactions } = useWallet()

  const [ address, setAddress ] = useState("")

  const [ assets, setAssets ] = useState([])

  const [ finalDraft, setFinalDraft ] = useState("")

  const [ fundAsset, setFundAsset ] = useState("")
  const [ fundAmount, setFundAmount ] = useState("")

  const [ proposal, setProposal ] = useState("")

  const [ votes, setVotes ] = useState(null)

  const [ amendments, setAmendments ] = useState([])


  const [ amend, setAmend ] = useState("")

  const [ currRound, setCurrRound ] = useState(null)
  const [ propRound, setPropRound ] = useState(null)


  const router = useRouter()

    React.useEffect(() => {

      const fetchData = async () => {


          const token = {
            'X-API-Key': process.env.indexerKey
          }

          const client = new algosdk.Algodv2(token, 'https://mainnet-algorand.api.purestake.io/ps2', '')

          let status = await client.status().do();

          setCurrRound(status["last-round"])

          let address = await algosdk.getApplicationAddress(Number(router.query.id))

          setAddress(address)

          try {

          let responseDraft = await client.getApplicationBoxByName(Number(router.query.id), "Draft").do();
          let draft = new TextDecoder().decode(responseDraft.value)
          setFinalDraft(draft)
          }
          catch{
            
          }

          let responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Proposal").do();
          let string = new TextDecoder().decode(responseProposal.value)
          setProposal(string)

          responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Votes").do();
          let accept = 0
          let reject = 0
          responseProposal.value.forEach((value) => {
            if (value == 49) {
              accept++
            }
            if (value == 50) {
              reject++
            }
          })
          if (accept > 0 || reject > 0) {
            setVotes([{vote: "Accept", count: accept}, {vote: "Reject", count: reject}])
          }

          setAmendments([])
          setAssets([])

          const indexerClient = new algosdk.Indexer(token, 'https://mainnet-algorand.api.purestake.io/idx2', '');


          const accountInfo = await indexerClient.lookupAccountByID(address).do();

          setAssets([{assetId: 0, amount: accountInfo.account.amount / 1000000, unitName: "ALGO"}])

          if (accountInfo.account.assets) {
            accountInfo.account.assets.forEach( async (asset) => {
              let assetInfo = await indexerClient.lookupAssetByID(asset["asset-id"]).do();
              let unitName = assetInfo.asset.params["unit-name"]
              let decimals = assetInfo.asset.params.decimals
              let div = 10**decimals
              setAssets(assets => [...assets, {assetId: asset["asset-id"], amount: asset.amount / div, unitName: unitName}])
    
             })
          }

         


          let global = await indexerClient.lookupApplications(Number(router.query.id)).do();

          let globalState = global.application.params["global-state"]

          let amendNum

          globalState.forEach((keyVal) => {
            if (atob(keyVal.key) == "amendNum") {
              amendNum = keyVal.value.uint
            }
            else if (atob(keyVal.key) == "round") {
              setPropRound(keyVal.value.uint)
            }
          })


          for (let i = 0; i < amendNum; i++) {
            responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Amend" + String(i)).do();
            string = new TextDecoder().decode(responseProposal.value)

            responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Votes" + String(i)).do();

            let accept = 0
            let reject = 0
            let votes
            responseProposal.value.forEach((value) => {
              if (value == 49) {
                accept++
              }
              if (value == 50) {
                reject++
              }
            })
            if (accept > 0 || reject > 0) {
              votes = [{vote: "Accept", count: accept}, {vote: "Reject", count: reject}]
            }

            setAmendments(amendments => [...amendments, {amendment: string, votes: votes, amendNum: i}])
          }
  
          }
          if (router.query.id) {
            fetchData();
          }

      }, [router])

      const handleChange = (event) => {

      
        const target = event.target;
        let value = target.type === 'checkbox' ? target.checked : target.value;
        const name = target.name;
    
        if (name == "amend") {
          setAmend(value)
        }
        if (name == "fundAsset") {
          setFundAsset(value)
        }
        if (name == "fundAmount") {
          setFundAmount(value)
        }
        
    
      }

      const fund = async () => {

        try {
        const token = {
          'X-API-Key': process.env.indexerKey
        }

        const client = new algosdk.Algodv2(token, 'https://mainnet-algorand.api.purestake.io/ps2', '')

        let params = await client.getTransactionParams().do();


        let txns = []

        let ftxn

        if (Number(fundAsset) == 0) {
          ftxn = algosdk.makePaymentTxnWithSuggestedParams(
            activeAccount.address, 
            address, 
            Number(fundAmount) * 1000000, 
            undefined,
            undefined,
            params
          );

          txns.push(ftxn)
        }
        else {
          const indexerClient = new algosdk.Indexer(token, 'https://mainnet-algorand.api.purestake.io/idx2', '');

          const assetInfo = await indexerClient.lookupAssetByID(fundAsset).do();

          let decimals = assetInfo.asset.params.decimals
          let div = 10**decimals

          ftxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
            activeAccount.address, 
            address, 
            undefined,
            undefined,
            Number(fundAmount) * div, 
            undefined,
            Number(fundAsset),
            params
          );

         

          let appArgs = []
          appArgs.push(
            new Uint8Array(Buffer.from("optin"))
          )

          let accounts = []
          let foreignApps = []
            
          let foreignAssets = [Number(fundAsset)]
          
          let wtxn = algosdk.makeApplicationNoOpTxn(activeAccount.address, params, Number(router.query.id), appArgs, accounts, foreignApps, foreignAssets, undefined, undefined, undefined);

          txns.push(wtxn)

          txns.push(ftxn)

          let txgroup = algosdk.assignGroupID(txns)

        }

        let encodedTxns= []

        txns.forEach((txn) => {
          let encoded = algosdk.encodeUnsignedTransaction(txn)
          encodedTxns.push(encoded)
  
        })

        props.setProgress(0)

        props.setMessage("Sign transaction...")
  
        const signedTransactions = await signTransactions(encodedTxns)

        props.setProgress(0)

        props.setMessage("Sending transactions...")

        const { id } = await sendTransactions(signedTransactions)

        let confirmedTxn = await algosdk.waitForConfirmation(client, id, 4);

        props.setMessage("Proposal funded.")

        setAssets([])

        const indexerClient = new algosdk.Indexer(token, 'https://mainnet-algorand.api.purestake.io/idx2', '');


        const accountInfo = await indexerClient.lookupAccountByID(address).do();

        setAssets([{assetId: 0, amount: accountInfo.account.amount / 1000000, unitName: "ALGO"}])

        if (accountInfo.account.assets) {
          accountInfo.account.assets.forEach( async (asset) => {
            let assetInfo = await indexerClient.lookupAssetByID(asset["asset-id"]).do();
            let unitName = assetInfo.asset.params["unit-name"]
            let decimals = assetInfo.asset.params.decimals
            let div = 10**decimals
            setAssets(assets => [...assets, {assetId: asset["asset-id"], amount: asset.amount / div, unitName: unitName}])
  
            })
        }

        }
        catch(error) {
          props.setMessage(String(error))
          props.setProgress(0)
          await props.sendDiscordMessage(error, "Fund", activeAccount.address)
        }

      }

      const amendSend = async () => {

        try {

        const token = {
          'X-API-Key': process.env.indexerKey
        }

        const client = new algosdk.Algodv2(token, 'https://mainnet-algorand.api.purestake.io/ps2', '')

        let txns = []

        let params = await client.getTransactionParams().do();

        let address = await algosdk.getApplicationAddress(Number(router.query.id))

        let ftxn = algosdk.makePaymentTxnWithSuggestedParams(
          activeAccount.address, 
          address, 
          10000000, 
          undefined,
          undefined,
          params
        );

        txns.push(ftxn)
  
        let encodedTxns= []

        txns.forEach((txn) => {
          let encoded = algosdk.encodeUnsignedTransaction(txn)
          encodedTxns.push(encoded)
  
        })

        props.setProgress(0)

        props.setMessage("Sign transaction...")
  
        const signedTransactions = await signTransactions(encodedTxns)

        props.setProgress(0)

        props.setMessage("Sending transactions...")

        const { id } = await sendTransactions(signedTransactions)



        let confirmedTxn = await algosdk.waitForConfirmation(client, id, 4);

        props.setMessage("Sanitizing amendment...")
        props.setProgress(40)

        const responseAmend = await fetch('/api/council/sanitizeAmend', {
          method: "POST",
          body: JSON.stringify({
            proposal: proposal,
            amend: amend
          }),
          headers: {
            "Content-Type": "application/json",
          }
            
        });
      
        const sessionAmend = await responseAmend.json()

        const indexerClient = new algosdk.Indexer(token, 'https://mainnet-algorand.api.purestake.io/idx2', '');

        let global = await indexerClient.lookupApplications(Number(router.query.id)).do();

        let globalState = global.application.params["global-state"]

        let amendNum

        globalState.forEach((keyVal) => {
          if (atob(keyVal.key) == "amendNum") {
            amendNum = keyVal.value.uint
          }
        })

        let appArgs = []
        appArgs.push(
          new Uint8Array(Buffer.from("amend")),
          new Uint8Array(Buffer.from(sessionAmend.text)),
        )

        let accounts = []
        let foreignApps = []
          
        let foreignAssets = []

        let amendBox = new Uint8Array(Buffer.from("Amend" + String(amendNum)))
        let votesBox = new Uint8Array(Buffer.from("Votes" + String(amendNum)))

        let boxes = [{appIndex: 0, name: amendBox}, {appIndex: 0, name: amendBox}, {appIndex: 0, name: votesBox}, {appIndex: 0, name: votesBox}]
        
        let wtxn = algosdk.makeApplicationNoOpTxn("YRVK422KP65SU4TBAHY34R7YT3OYFOL4DUSFR4UADQEQHS2HMXKORIC6TE", params, Number(router.query.id), appArgs, accounts, foreignApps, foreignAssets, undefined, undefined, undefined, boxes);

        const houseMnemonic = process.env.DCwallet
        const houseAccount =  algosdk.mnemonicToSecretKey(houseMnemonic)

        let signedTxn = wtxn.signTxn(houseAccount.sk);
        props.setProgress(80)

        props.setMessage("Sending amendment...")

        let txId = wtxn.txID().toString();

        // Submit the transaction
        await client.sendRawTransaction(signedTxn).do()                           
        // Wait for transaction to be confirmed
        confirmedTxn = await algosdk.waitForConfirmation(client, txId, 4);

        props.setMessage("Amendment successfully sent")

        props.setProgress(100)

        setAmendments(amendments => [...amendments, {amendment: sessionAmend.text, votes: null, amendNum: amendNum}])

        updateDiscord(sessionAmend.text)



      }

        catch(error) {
          props.setMessage(String(error))
          props.setProgress(0)
          await props.sendDiscordMessage(error, "Amend", activeAccount.address)
         }


      }

      const vote = async (vote, type, num) => {

        try {

        let daos = []

        props.wallet.forEach((asset) => {
         if (asset.params["unit-name"].substring(0,4) == "DCGV") {
           daos.push(asset.index)
         }
        })

        const token = {
          'X-API-Key': process.env.indexerKey
        }

        const client = new algosdk.Algodv2(token, 'https://mainnet-algorand.api.purestake.io/ps2', '')
            
        let params = await client.getTransactionParams().do();

        let txns = []
        let txn
  
  
          for (let i = 0; i < daos.length; i++) {
  
            if (i < 16) {
              const appArgs = []

              if (type == "amend") {
                appArgs.push(
                  new Uint8Array(Buffer.from("voteAmend")),
                  new Uint8Array(Buffer.from(String(num)))

                )
              }
              else {
                appArgs.push(
                  new Uint8Array(Buffer.from("voteProp"))
                )
              }


              appArgs.push(
                new Uint8Array(Buffer.from(String(vote)))
              )
  
              const accounts = []
              const foreignApps = []
                  
              let foreignAssets = [daos[i]]

              let voteBox

              if (type == "amend") {
                voteBox = new Uint8Array(Buffer.from("Votes" + String(num)))

              }
              else {
                voteBox = new Uint8Array(Buffer.from("Votes"))
              }
    
              const boxes = [{appIndex: 0, name: voteBox}, {appIndex: 0, name: voteBox}]
              
              txn = algosdk.makeApplicationNoOpTxn(activeAccount.address, params, Number(router.query.id), appArgs, accounts, foreignApps, foreignAssets, undefined, undefined, undefined, boxes);          
              
              txns.push(txn)
  
              
            }
            
          }

          if (daos.length > 1) {
            let txgroup = algosdk.assignGroupID(txns)
          }

          props.setProgress(0)
  
          props.setMessage("Sign transaction...")
  
          let encodedTxns= []
  
          txns.forEach((txn) => {
            let encoded = algosdk.encodeUnsignedTransaction(txn)
            encodedTxns.push(encoded)
    
          })
    
          const signedTransactions = await signTransactions(encodedTxns)

          props.setMessage("Sending transaction...")

          
          const { id } = await sendTransactions(signedTransactions)


          let confirmedTxn = await algosdk.waitForConfirmation(client, id, 4);

          props.setMessage("Votes successfully cast.")

          if (type == "amend") {
            setAmendments([])

            const indexerClient = new algosdk.Indexer(token, 'https://mainnet-algorand.api.purestake.io/idx2', '');

            let global = await indexerClient.lookupApplications(Number(router.query.id)).do();

            let globalState = global.application.params["global-state"]

            let amendNum

            globalState.forEach((keyVal) => {
              if (atob(keyVal.key) == "amendNum") {
                amendNum = keyVal.value.uint
              }
            })

            for (let i = 0; i < amendNum; i++) {
              let responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Amend" + String(i)).do();
              let string = new TextDecoder().decode(responseProposal.value)

              responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Votes" + String(i)).do();
              let accept = 0
              let reject = 0
              let votes
              responseProposal.value.forEach((value) => {
                if (value == 49) {
                  accept++
                }
                if (value == 50) {
                  reject++
                }
              })
              if (accept > 0 || reject > 0) {
                votes = [{vote: "Accept", count: accept}, {vote: "Reject", count: reject}]
              }

              setAmendments(amendments => [...amendments, {amendment: string, votes: votes, amendNum: i}])
            }
          }
          else {
            let responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Proposal").do();
            let string = new TextDecoder().decode(responseProposal.value)
            setProposal(string)

            responseProposal = await client.getApplicationBoxByName(Number(router.query.id), "Votes").do();
            let accept = 0
            let reject = 0
            responseProposal.value.forEach((value) => {
              if (value == 49) {
                accept++
              }
              if (value == 50) {
                reject++
              }
            })
            if (accept > 0 || reject > 0) {
              setVotes([{vote: "Accept", count: accept}, {vote: "Reject", count: reject}])
            }
          }

          



        
        }

          catch(error) {
            props.setMessage(String(error))
            props.setProgress(0)
            await props.sendDiscordMessage(error, "Vote", activeAccount.address)
           }

      }

      const draft = async () => {

        try {

        let accepted

        if (votes[0].count > votes[1].count) {
          accepted = true
        }
        else {
          accepted = false
        }

        console.log(accepted)

        let acceptedAmendments = []

        amendments.forEach((amendment) => {
          console.log(amendment)
          if (amendment.votes[0].count > amendment.votes[1].count) {
            acceptedAmendments.push(amendment.amendment)
          }
        })
        

        console.log(acceptedAmendments)

        const response = await fetch('/api/council/getDraft', {
          method: "POST",
          body: JSON.stringify({
            proposal: proposal,
            amendments: acceptedAmendments
          }),
          headers: {
            "Content-Type": "application/json",
          }
            
        });
      
        const session = await response.json()

        console.log(session.text)

        const token = {
          'X-API-Key': process.env.indexerKey
        }

        const client = new algosdk.Algodv2(token, 'https://mainnet-algorand.api.purestake.io/ps2', '')
            
        let params = await client.getTransactionParams().do();

        let appArgs = []

        if (accepted) {
          appArgs.push(
            new Uint8Array(Buffer.from("accept")),
            new Uint8Array(Buffer.from(session.text)),
          )
        }
        appArgs.push(
          new Uint8Array(Buffer.from("reject")),
        )

        let accounts = []
        let foreignApps = []
          
        let foreignAssets = []

        let boxes

        let draftBox = new Uint8Array(Buffer.from("Draft"))

        if (accepted) {
          boxes = [{appIndex: 0, name: draftBox}, {appIndex: 0, name: draftBox}, {appIndex: 0, name: draftBox}, {appIndex: 0, name: draftBox}]
        }

        
        let wtxn = algosdk.makeApplicationNoOpTxn("YRVK422KP65SU4TBAHY34R7YT3OYFOL4DUSFR4UADQEQHS2HMXKORIC6TE", params, Number(router.query.id), appArgs, accounts, foreignApps, foreignAssets, undefined, undefined, undefined, boxes);

        const houseMnemonic = process.env.DCwallet
        const houseAccount =  algosdk.mnemonicToSecretKey(houseMnemonic)

        let signedTxn = wtxn.signTxn(houseAccount.sk);
        props.setProgress(80)

        props.setMessage("Writing draft...")

        let txId = wtxn.txID().toString();

        // Submit the transaction
        await client.sendRawTransaction(signedTxn).do()                           
        // Wait for transaction to be confirmed
        confirmedTxn = await algosdk.waitForConfirmation(client, txId, 4);

        props.setMessage("Draft successfully written")

        updateDraft(session.text)

      }
      catch(error) {
        props.setMessage(String(error))
        props.setProgress(0)
        await props.sendDiscordMessage(error, "Draft", activeAccount.address)
       }

        

        
      }

      const updateDraft = async (draft) => {

      

        let embeds = []
  
        embeds.push({
            "title": "A proposal has been drafted!",
            "color": 0
        })

       
        
  
        embeds.push({
            "title": "Proposal",
            "description": String(proposal),
            "url": "https://dark-coin.com/council/proposals/" + String(router.query.id),
            "color": 16777215
        })

        embeds.push({
          "title": String(draft),
          "color": 0
      })
  
  
        const response = await fetch(process.env.discordCouncilWebhook, {
            method: "POST",
            body: JSON.stringify({
                username: "Council Draft",
                embeds: embeds
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });
  
  
  
        
    }

      const updateDiscord = async (amendment) => {

      

        let embeds = []
  
        embeds.push({
            "title": "A new amendment has been made!",
            "color": 0
        })

       
        
  
        embeds.push({
            "title": "Proposal",
            "description": String(proposal),
            "url": "https://dark-coin.com/council/proposals/" + String(router.query.id),
            "color": 16777215
        })

        embeds.push({
          "title": String(amendment),
          "color": 0
      })
  
  
        const response = await fetch(process.env.discordCouncilWebhook, {
            method: "POST",
            body: JSON.stringify({
                username: "Council Amend",
                embeds: embeds
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });
  
  
  
        
    }

      let renderTooltip = (props) => {
        const { active, payload } = props;

        if (active && payload && payload.length) {
        const data = payload[0] && payload[0].payload;

        return (
            <div 
            style={{
            backgroundColor: "#fff",
            border: "1px solid #999",
            margin: "0px",
            padding: "10px"
            }}>
            {data.value}
            </div>
        );
        }

        return null;
      };

            

      let date = new Date()

      const RADIAN = Math.PI / 180;
        const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, vote, count }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {vote} = {`${(percent * 100).toFixed(2)}%`} ({count})
            </text>
          
        );
      };


     let daos = 0

     props.wallet.forEach((asset) => {
      if (asset.params["unit-name"].substring(0,4) == "DCGV") {
        daos++
      }
     })

     let parsedAmendments = []

     parsedAmendments = amendments.sort((a,b) => b.amendNum - a.amendNum)

     console.log(currRound)
     console.log(propRound)

        return (
            <div >
              {/* <Button  style={{color: "white", display: "flex", margin: "auto"}} onClick={() => window.open("https://algoexplorer.io/address/" + address)}>
                  {address}
                </Button> */}
                {currRound > (propRound + 366000) && finalDraft ? 
                <Grid container justifyContent="center" alignItems="center" style={{display: "flex", margin: "auto", padding: 40}}>
                <Grid item xs={12} sm={12} md={12} >
                {assets.length > 0 ? 
                assets.map((asset, index) => {
                  return (
                    <Typography key={index} color="secondary" variant="h6" align="center"> {asset.unitName} | {asset.amount} </Typography>
                    )
                })
                :
                null
                }
                </Grid>
                
             
                <Grid item xs={12} sm={6}>
                
                <br />
                  
                  <TextField                
                      onChange={handleChange}
                      value={fundAsset}
                      multiline
                      type="number"
                      label={<Typography color="primary" variant="caption" align="center" style={{backgroundColor: "white", padding: 20, borderRadius: 50}}> Asset Id (Algo = 0) </Typography>}
                      name="fundAsset"
                      autoComplete="false"
                      InputProps={{ style: { color: "black" } }}
                    
                      style={{
                      color: "black",
                      background: "white",
                      borderRadius: 15,
                      display: "flex",
                      margin: "auto",
                      width: "80%"
                    
                      }}
                    />

                </Grid>
                <Grid item xs={12} sm={6}>
                
                <br />
                  
                  <TextField                
                      onChange={handleChange}
                      value={fundAmount}
                      multiline
                      type="number"
                      label={<Typography color="primary" variant="caption" align="center" style={{backgroundColor: "white", padding: 20, borderRadius: 50}}> Asset Amount </Typography>}
                      name="fundAmount"
                      autoComplete="false"
                      InputProps={{ style: { color: "black" } }}
                    
                      style={{
                      color: "black",
                      background: "white",
                      borderRadius: 15,
                      display: "flex",
                      margin: "auto",
                      width: "80%"
                    
                      }}
                    />

                </Grid>
                <Grid item xs={12} sm={6}>

                <br />
                <Button variant="contained" color="secondary" style={{display: "flex", margin: "auto"}} onClick={() => fund()}>
                  <Typography  variant="h6"> Fund </Typography>
                </Button>
                </Grid>
                </Grid>
                :
                null
                }
              

              


              
                {(amendments.length > 1 && currRound > (propRound + 549000)) || (amendments.length == 0 && currRound > (propRound + 366000)) ? 
                <Grid container justifyContent="center" alignItems="center" style={{display: "flex", margin: "auto", padding: 40}}>
                  <Grid item xs={12} sm={12}>

                  <Button variant="contained" color="secondary" style={{display: "flex", margin: "auto"}} onClick={() => draft()}>
                    <Typography  variant="h6"> Draft </Typography>
                  </Button>
                  <br />
                  </Grid>
                    <Grid item sm={12}>
                    <Typography variant="h6" align="center" style={{color: "white"}}>
                      {proposal}
                    </Typography>
                    <br />             
                    {votes ? 
                    <ResponsiveContainer aspect={2} width="100%">
                    <PieChart >
                    <Pie
                        dataKey="count"
                        data={votes}
                        label={renderCustomizedLabel}
                        fill="#000000"
                    />

                    </PieChart>
                    </ResponsiveContainer>
                    :
                    null
                    }
                    </Grid>
                    {daos ?
                    <Grid item sm={12}>
                      <Typography variant="subtitle1" align="center" style={{color: "white", padding: 10}}>
                        My DAO = {daos}
                      </Typography>
                    </Grid>
                    
                    :
                    null
                    }
                    
                    <Grid item sm={6} md={4}>
                    <Button variant="contained" style={{color: "white", border: "1px solid white"}} onClick={() => vote(1, "prop", -1)}>
                      Accept
                    </Button>
                    </Grid>
                    
                    <Grid item >
                    <Button variant="contained" style={{color: "white", border: "1px solid white"}} onClick={() => vote(2, "prop", -1)}>
                      Reject
                    </Button>
                    </Grid>
                  </Grid>
                  :
                  <Typography variant="h6" align="center" style={{color: "white", padding: 40}}>
                  {proposal}
                </Typography>
                }
              


              {parsedAmendments.length > 0 ? 
              parsedAmendments.map((amendment, index) => {
                if ((currRound > (propRound + 183000)) && (currRound < (propRound + 366000))) {
                return (
                  <div key={index}>
                  <Grid container justifyContent="center" alignItems="center" style={{display: "flex", margin: "auto", padding: 40}}>
                    <Grid item sm={12}>
                    <Typography variant="subtitle1" align="center" style={{color: "white"}}>
                      {amendment.amendment}
                    </Typography>
                    <br />             
                    {amendment.votes ? 
                    <ResponsiveContainer aspect={2} width="100%">
                    <PieChart >
                    <Pie
                        dataKey="count"
                        data={amendment.votes}
                        label={renderCustomizedLabel}
                        fill="#000000"
                    />
        
                    </PieChart>
                    
                    </ResponsiveContainer>
                    :
                    null
                    }
                    </Grid>
                    
                    
                    <Grid item sm={6} md={4}>
                    <Button variant="contained" style={{color: "white", border: "1px solid white"}} onClick={() => vote(1, "amend", amendment.amendNum)}>
                      Accept
                    </Button>
                    </Grid>
                    
                    <Grid item >
                    <Button variant="contained" style={{color: "white", border: "1px solid white"}} onClick={() => vote(2, "amend", amendment.amendNum)}>
                      Reject
                    </Button>
                    </Grid>
                    

                  </Grid>
                  <hr />
                  </div>
                )
                }
                else {
                  return (
                    <Typography variant="subtitle1" align="center" style={{color: "white", padding: 20}}>
                      {amendment.amendment}
                    </Typography>
                  )
                }
              })
              :
              null
              }

              <br />
              <Typography color="secondary" variant="h6" align="center"> Amend this proposal </Typography>
              <br />
                 
                <TextField                
                    onChange={handleChange}
                    value={amend}
                    multiline
                    type="text"
                    label=""
                    name="amend"
                    autoComplete="false"
                    InputProps={{ style: { color: "black" } }}
                   
                    style={{
                    color: "black",
                    background: "white",
                    borderRadius: 15,
                    display: "flex",
                    margin: "auto",
                    width: "80%"
                   
                    }}
                  />
                <br />
                <Button variant="contained" color="secondary" style={{display: "flex", margin: "auto"}} onClick={() => amendSend()}>
                  <Typography  variant="h6"> Amend 10 </Typography>
                  <img src="/AlgoBlack.svg" style={{display: "flex", margin: "auto", width: 40, padding: 10}} />
                </Button>

            </div>
        )
    
    
}