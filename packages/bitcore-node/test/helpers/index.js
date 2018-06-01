import mongoose from 'mongoose';



export async function resetDatabase(){
  return mongoose.connection.db.dropDatabase();
}

export async function resetModel(model){
  return model.remove({});
}
