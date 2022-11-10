import NextCors from 'nextjs-cors';

const pinataSDK = require('@pinata/sdk');

const pinata = pinataSDK(process.env.publicPinata, process.env.privatePinata);


async function readNft(req, res) {
   // Run the cors middleware
   // nextjs-cors uses the cors package, so we invite you to check the documentation https://github.com/expressjs/cors

   await NextCors(req, res, {
      // Options
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      origin: '*',
      optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
   });



   // Rest of the API logic


    const filters = {
        hashContains: req.body.hash,
        status : 'pinned',
        pageLimit: 10,
        pageOffset: 0

    };

    pinata.pinList(filters).then((result) => {
        //handle results here
        console.log(result);
        res.json({ status : result });
    }).catch((err) => {
        //handle error here
        console.log(err);
    });

  

   
}

export default readNft