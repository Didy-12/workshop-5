import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";
import { delay } from "../utils";




export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());



 
  // the state of the node
  let state: NodeState = {
    killed: false,
    x: initialValue,
    decided: false,
    k: 0
  };


  // messages received by the node
  let messagesStep1: Map<number, Value[]> = new Map();
  let messagesStep2: Map<number, Value[]> = new Map();



  // if the node is faulty, reset the state
  if (isFaulty) {
    state.x = null;
    state.decided = null;
    state.k = null;
  }


  //DONE:Working
  // this route allows retrieving the current status of the node

  node.get("/status", (req, res) => {
    res.status(isFaulty ? 500 : 200).send(isFaulty ? "faulty" : "live");
  });






  //DONE:Working
  // this route allows the node to receive messages from other nodes
  node.post("/message", (req: Request, res: Response) => {
    if (!isFaulty) {
      let { x, k, step } = req.body;

      if (step === 1 && !state.decided && !state.killed) 
      {
        if (!messagesStep1.has(k)) 
        
        {
          messagesStep1.set(k, []);
        }

        messagesStep1.get(k)!.push(x);

        if (messagesStep1.get(k)!.length >= N - F) 
        
        {
          state.x = Step1(messagesStep1.get(k)!, state, N);
          sendMessagesToAll(2, state, N);
        }
      }

      if (step === 2 && !state.decided && !state.killed) 
      {

        if (!messagesStep2.has(k)) 
        {
          messagesStep2.set(k, []);
        }

        messagesStep2.get(k)!.push(x);

        if (messagesStep2.get(k)!.length >= N - F) 

        {
          Step2(messagesStep2.get(k)!, state, F);
          state.k = state.k! + 1;
          sendMessagesToAll(1, state, N);
        }
      }
    }
    res.status(200).send("success");
  });




  //DONE:Working
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) 
    {
      await delay(10);
    }

    if (!isFaulty) 
    
    {
      state.k = 1;
      sendMessagesToAll(1, state, N);
    }
    return res.status(200).send("success");
  });








  //DONE:Working
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => 
  {

    state.killed = true;
    res.status(200).send("killed");
  });




  //DONE:Working
  // get the current state of a node
  node.get("/getState", (req, res) => {
    if (isFaulty) 
    {
      res.status(200).json(state);
    }

    else 
    {
      if (!state.decided) 
      {
        res.status(200).json(state);
      }

      else 
      {
        state.k = state.k! - 1;
        res.status(200).json(state);
        state.k = state.k! + 1;
      }
    }
  });







  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}





// this function is used to decide the value of the node
function Step1(messages: Value[], state: NodeState, N: number) 
{

  let count0 = messages.filter((el) => el === 0).length;
  let count1 = messages.filter((el) => el === 1).length;

  if (2 * count0 > N) 
  {
    state.x = 0;
  }

  else if (2 * count1 > N) 
  {
    state.x = 1;
  }

  else 
  {
    state.x = "?";
  }
  return state.x;
}




// this function is used to decide the value of the node after step 1
function Step2(messsages: Value[], state: NodeState, F: number) 
{


  let count0 = messsages.filter((el) => el === 0).length;
  let count1 = messsages.filter((el) => el === 1).length;

  if (count0 > F) 
  {
    state.decided = true;
    state.x = 0;
  }

  else if (count1 > F) 
  {
    state.decided = true;
    state.x = 1;
  }

  else {
    if (count0 + count1 > 0 && count0 > count1) 
    {
      state.x = 0;
    }

    else if (count0 + count1 > 0 && count1 > count0) 
    {
      state.x = 1;
    }

    else {
      state.x = Math.floor(Math.random() * 2) ? 0 : 1;
    }
  }
  return state.x;
}


// send a message to all nodes
function sendMessagesToAll(step: number, state: NodeState, N: number) 

{
  for (let i = 0; i < N; i++) 
  
  {
    sendMessages(i, step, state);
  }
}

// we needed this function to send messages to other nodes
function sendMessages(destinationNodeId: number, step: number, state: NodeState) {
  fetch(`http://localhost:${BASE_NODE_PORT + destinationNodeId}/message`, 
  
  {
    method: 'POST',
    headers: 
    {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ x: state.x, k: state.k, step: step }),
  });
}


