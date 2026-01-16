const express = require('express');
const app = express();
app.get('/health',(req,res)=>res.json({ok:true}));
app.listen(5001,()=>console.log('test server running'));
