const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(express.static(__dirname + '/uploads'));
const uploadsFolder = path.join(__dirname, 'uploads');

//const upload = multer({ dest: 'uploads/' }); // File upload destination


// Ensure that the "uploads" folder exists
if (!fs.existsSync(uploadsFolder)) {
  fs.mkdirSync(uploadsFolder);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files to the 'uploads' directory
  },
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  },
});

const upload = multer({ storage: storage });

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'housing',
  password: 'Melvin',
  port: 5432,
});

app.use(cors());
app.use(express.json());

app.get('/message', (req, res) => {
    res.json({ message: "Hello from server!" });
});

app.post('/node/signup', async(req, res) => {
    console.log("req.body 1");
    const { email, password } = req.body;
    console.log("req.body", req.body.email, req.body.password);

    try {
      const existingUser = await pool.query('SELECT * FROM users WHERE useremail = $1', [email]);
      
      if (existingUser.rows.length > 0) {
        console.log("existingUser.rows.length", existingUser.rows.length);
        return res.status(400).json({ error: 'Email already in use' });
      }

      else{
        console.log("hash");
        // Hash
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save email and hashed password
        const newUser = await pool.query(
          'INSERT INTO users (useremail, userpassword) VALUES ($1, $2) RETURNING userid',
          [email, hashedPassword]
        );

        // Return the user ID
        res.status(201).json({ userId: newUser.rows[0].userid });
      }

    } catch (error) {
      console.error('Error during signup:', error);
      res.status(500).json({ error: 'An error occurred during signup' });
    }
   
  });


  app.post('/node/signin', async(req, res) => {
    console.log("req.body 1");
    const { email, password } = req.body;
    console.log("req.body", req.body.email, req.body.password);

    try {
      const user = await pool.query('SELECT * FROM users WHERE useremail = $1', [email]);
      
      if (user.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      const hashedPassword = user.rows[0].userpassword;
      console.log("hashedPassword", hashedPassword);
      console.log("password", password);
  
      const passwordMatch = await bcrypt.compare(password, hashedPassword);
      console.log("passwordMatch", passwordMatch);
      const userId = user.rows[0].userid;

      if (passwordMatch) {
        const token = jwt.sign({ userId }, 'secret_key');

        console.log("token: ", token);
        console.log("userId: ", userId);

        await pool.query('UPDATE users SET usertoken = $1 WHERE userid = $2', [token, userId]);
        
        return res.status(200).json({ userId: userId, jwt: token});
      } else {

        return res.status(400).json({ error: 'Invalid password' });
      }

    } catch (error) {
      console.error('Error during login:', error);
      return res.status(500).json({ error: 'An error occurred during login' });
    }
   
  });

  app.post('/node/createlisting', upload.array('photos', 5), async (req, res) => {
    try {
      console.log("req.filesyyyyyyyyyyyyyyyyyyyyyyyyy", req.body)
      console.log("req.filesyyyyyyyyyyyyyyyyyyyyyyyyy", req.body.jwt);
      console.log("req..listingtype", req.body.listingtype);


/*      for(var i = 0; i < req.files.length;i++){
        console.log("req.files[iiiiiiiiiiiiiiiiiiiiiiiiiiiii]", req.files[i])
      }*/
      // Handle the uploaded photos here
      const uploadedPhotos = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        mimeType: file.mimetype,
        dataurl: file.dataurl,
      }));

 /*     const uploadedPhotos = await Promise.all(req.files.map(async (file) => {
        const blob = await createImageBlob(file.path);
        return {
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          mimeType: file.mimetype,
          blob: blob,
          url: file.url,
        };
      }));*/
      const token =  req.body.jwt;
      console.log("token: ", token)


      // Verify the token and decode its payload
      const decodedToken = jwt.verify(token, 'secret_key');
      
      // The decodedToken will contain the payload data, including the userId
      const userId = decodedToken.userId;
      
      console.log('User ID:', userId);
      console.log('req.body.listingtype:', req.body.listingtype);


      const query = 'INSERT INTO houses (houselistingtype, housepropertytype, housesurburb, househeading, housedescription, houseprice, housebedroom, housebathroom, houseareaunit, houseuserid, housestreetname) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING houseid';
      const values = [req.body.listingtype, req.body.propertytype, req.body.surburb, req.body.heading, req.body.description, req.body.price, req.body.bedroom, req.body.bathroom, req.body.areaunit, userId, req.body.streetname];
      const result = await pool.query(query, values);
    
      // Extract the inserted row data from the result

      const houseid = result.rows[0].houseid;

      console.log("houseid", houseid);
      const dirname = path.resolve();

      const insertImagesQuery = 'INSERT INTO houseimages (houseimageoriginalname, houseimagefilename, houseimagepath, houseimagemimetype, houseimageimageurl, houseimagehouseid) VALUES ($1, $2, $3, $4, $5, $6)';
      for (const image of uploadedPhotos) {
        console.log("imagex", image);
          console.log("image", image.path);
          console.log("image.dataurl", image.dataurl);
          const fullfilepath = path.join(dirname, 'images/' + image.filename);
          console.log("fullfilepath", fullfilepath);
          const imageurl = "http://localhost:8000/"+image.filename
          const insertImagesValues = [image.originalName, image.filename, image.path, image.mimeType, imageurl, houseid];
           pool.query(insertImagesQuery, insertImagesValues);
      }

      // Respond with success message
      return res.status(201).json({ message: 'Housing data and images inserted successfully' });

    } catch (error) {
      console.error('Error inserting housing data and images:', error);
      return res.status(500).json({ error: 'Error inserting housing data and images' });
    }
  });


  app.post('/node/updatelisting', upload.array('photos', 5), async (req, res) => {
    try {
      console.log("req.filesyyyyyyyyyyyyyyyyyyyyyyyyy", req.body)
      console.log("req.filesyyyyyyyyyyyyyyyyyyyyyyyyy", req.body.jwt);
      console.log("req..listingtype", req.body.listingtype);



      const uploadedPhotos = req?.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        mimeType: file.mimetype,
        dataurl: file.dataurl,
      }));

      console.log("req.filesyyyyyyyyyyyyyyyyyyyyyyyyy", req.body)
      let houseId =  req.body.houseid;
      console.log("houseid: ", houseId);
      console.log("price: ", req.body.price);
      console.log("bedroom: ", req.body.bedroom);
      console.log("bathroom: ", req.body.bathroom);
      console.log("areaunit: ", req.body.areaunit);
      
//      const updateQuery = 'UPDATE houses SET houselistingtype = $1, housepropertytype = $2, housesurburb = $3, househeading = $4, housedescription = $5, houseprice = $6,  housebedroom = $7, housebathroom = $8, houseareaunit = $9, housestreetname = $10   WHERE houseid = $11';
//      const updateValues = [req.body.listingtype, req.body.propertytype, req.body.surburb, req.body.heading, req.body.description, req.body.price, req.body.bedroom, req.body.bathroom, req.body.areaunit, req.body.streetname, houseId];
      const updateQuery = 'UPDATE houses SET houselistingtype = $1, housepropertytype = $2, housesurburb = $3, househeading = $4, housedescription = $5, houseprice = $6,  housebedroom = $7, housebathroom = $8, houseareaunit = $9, housestreetname = $10 WHERE houseid = $11';
      const updateValues = [req.body.listingtype, req.body.propertytype, req.body.surburb, req.body.heading, req.body.description, parseInt(req.body.price), parseInt(req.body.bedroom), parseInt(req.body.bathroom), parseInt(req.body.areaunit), req.body.streetname, houseId];

      await pool.query(updateQuery, updateValues);


      const insertImagesQueryTwo = 'INSERT INTO houseimages (houseimageoriginalname, houseimagefilename, houseimagepath, houseimagemimetype, houseimageimageurl, houseimagehouseid) VALUES ($1, $2, $3, $4, $5, $6)';
      for (const image of uploadedPhotos) {
        console.log("imagex", image);
          console.log("image", image.path);
 //         console.log("image.dataurl", image.dataurl);
//          const fullfilepath = path.join(dirname, 'images/' + image.filename);
//          console.log("fullfilepath", fullfilepath);
          const imageurl = "http://localhost:8000/"+image.filename
          const insertImagesValues = [image.originalName, image.filename, image.path, image.mimeType, imageurl, houseId];
           pool.query(insertImagesQueryTwo, insertImagesValues);
      }

    

      // Respond with success message
      return res.status(200).json({ message: 'House and images updated successfully.' });

    } catch (error) {
      console.error('Error updating house and image data:', error);
      return res.status(500).json({ error: 'Error updating house and image data.' });
    }
  });





  app.post('/node/gethouses', async (req, res) => {
    

    console.log('xxxxxxxxxxx');
    const { jwttoken } = req.body;

    const decodedToken = jwt.verify(jwttoken, 'secret_key');
      
    // The decodedToken will contain the payload data, including the userId
    const userId = decodedToken.userId;
    
    console.log('User ID:', userId);
  
    try {
      // Fetch houses with a certain houseuserid from the houses table
      const housesQuery = 'SELECT * FROM houses WHERE houseuserid = $1';
      const housesValues = [userId];
      const housesResult = await pool.query(housesQuery, housesValues);
      const houses = housesResult.rows;

      console.log("houses: ", houses);
 //     console.log("json({ houses:houses }: ", json({ houses:houses }));

      // Respond with the houses and their respective images
      
      return res.status(200).json({ houses:houses });
    } catch (error) {
      console.error('Error fetching houses:', error);
      return res.status(500).json({ error: 'Error fetching houses.' });
    }

  });

  app.get('/node/geteachhouse/:houseid', async (req, res) => {
    const houseid = req.params.houseid;
  
    try {
      // Fetch house details from the houses table by houseid
      const houseQuery = 'SELECT * FROM houses WHERE houseid = $1';
      const houseValues = [houseid];
      const houseResult = await pool.query(houseQuery, houseValues);
      const houseDetails = houseResult.rows[0];
  
      if (!houseDetails) {
        return res.status(404).json({ error: 'House not found' });
      }
  
      // Fetch images from the houseimages table with the same houseimagehouseid
      const imagesQuery = 'SELECT * FROM houseimages WHERE houseimagehouseid = $1';
      const imagesValues = [houseid];
      const imagesResult = await pool.query(imagesQuery, imagesValues);
      const houseImages = imagesResult.rows;
  
      // Attach the house images to the house details object
      houseDetails.images = houseImages;
 
      const dirname = path.resolve();
      console.log("dirname", dirname);
      const fullfilepath = path.join(dirname, 'images/' + 'filename');
      console.log("fullfilepath", fullfilepath);

      return res.status(200).json({ house: houseDetails });
    } catch (error) {
      console.error('Error fetching house details:', error);
      return res.status(500).json({ error: 'Error fetching house details' });
    }
  });

  app.delete('/node/deletehouse/:houseid', async (req, res) => {
    const houseid = req.params.houseid;
    
  
    try {
      // Start a transaction to ensure atomicity (either delete all or none)
      await pool.query('BEGIN');

      // Delete the house from the houses table
      const deleteHouseQuery = 'DELETE FROM houses WHERE houseid = $1';
      const deleteHouseValues = [houseid];
      await pool.query(deleteHouseQuery, deleteHouseValues);

      // Delete all houseimages associated with the houseid from the houseimages table
      const deleteHouseImagesQuery = 'DELETE FROM houseimages WHERE houseimagehouseid = $1';
      const deleteHouseImagesValues = [houseid];
      await pool.query(deleteHouseImagesQuery, deleteHouseImagesValues);

      // Commit the transaction
      await pool.query('COMMIT');

      // Send a response back to the client
      res.status(200).json({ message: 'House and associated images deleted successfully' });
  
    } catch (error) {
      // Rollback the transaction in case of any error
      await pool.query('ROLLBACK');
      
      console.error('Error deleting house and associated images:', error);
      res.status(500).json({ error: 'Failed to delete house and associated images' });
    }
  });

  // Define the GET route to search for houses and their images based on the provided parameters
app.post('/node/search', async (req, res) => {
  console.log("xxxxxxxxxxxxxxxxxxx");
  const { houselistingtype, housepropertytype, housesurburb, houseprice } = req.body;
  console.log("houselistingtype", houselistingtype);
  console.log("housepropertytype", housepropertytype);
  console.log("housesurburb", housesurburb);
  console.log("houseprice", houseprice);

  try {
    // Search for houses that match the criteria and their respective images
    const query =
      'SELECT houses.*, houseimages.houseimageimageurl FROM houses LEFT JOIN houseimages ON houses.houseid = houseimages.houseimagehouseid WHERE houselistingtype LIKE $1 AND housepropertytype LIKE $2 AND housesurburb LIKE $3 AND houseprice <= $4';

    const values = [
      `%${houselistingtype}%`,
      `%${housepropertytype}%`,
      `%${housesurburb}%`,
      houseprice,
    ];

    const result = await pool.query(query, values);
    console.log("result:", result);

    // Group the results by houseid and include the images for each house
    const housesWithImages = result.rows.reduce((houses, row) => {
      const houseId = row.houseid;
      if (!houses[houseId]) {
        houses[houseId] = {
          houseid: houseId,
          houselistingtype: row.houselistingtype,
          housepropertytype: row.housepropertytype,
          houseprice: row.houseprice,
          housedescription: row.housedescription,
          househeading: row.househeading,
          housesurburb: row.housesurburb,
          housebedroom: row.housebedroom,
          housebathroom: row.housebathroom,
          houseareaunit: row.houseareaunit,
          housestreetname: row.housestreetname,
          images: [],
        };
      }
      if (row.houseimageimageurl) {
        houses[houseId].images.push({ houseimageimageurl: row.houseimageimageurl });
      }
      return houses;
    }, {});

    

    // Convert the object of housesWithImages into an array
    const housesArray = Object.values(housesWithImages);
    console.log("housesArray", housesArray);

    // Send the response back to the client
    res.status(200).json({ houses: housesArray });
  } catch (error) {
    console.error('Error searching for houses:', error);
    res.status(500).json({ error: 'Error searching for houses' });
  }
});


app.post('/node/savepropery', async(req, res) => {
  console.log("req.body 1");
  const { token, houseid } = req.body;
  console.log("jwt, houseid", token, houseid);

  try {

    console.log("token: ", token)


    // Verify the token and decode its payload
    const decodedToken = jwt.verify(token, 'secret_key');
    
    // The decodedToken will contain the payload data, including the userId
    const userId = decodedToken.userId;
    
    console.log('User ID:', userId);

    const selectBookmarkQuery = 'SELECT * FROM bookmarks WHERE bookmarkuserid = $1 AND bookmarkhouseid = $2';
    const selectBookmarkValues = [userId, houseid];

    const { rows } = await pool.query(selectBookmarkQuery, selectBookmarkValues);

    if (rows.length > 0) {
      console.log('Entry already exists');
       return res.status(400).json({ message: 'Entry already exists' });
    } else {
      const insertBookmarkQuery = 'INSERT INTO bookmarks (bookmarkuserid, bookmarkhouseid) VALUES ($1, $2)';
      const insertBookmarkValues = [userId, houseid];
      await pool.query(insertBookmarkQuery, insertBookmarkValues);
  
      console.log('step 5');

      return res.status(201).json({ message: 'Bookmark has been inserted successfully' });

    }
    


    // Respond with success message
    


  } catch (error) {
    console.error('Error when saving:', error);
    res.status(500).json({ error: 'An error occurred when saving' });
  }
 
});

app.post('/node/getbookmarks', async (req, res) => {
    

  console.log('xxxxxxxxxxx');
  const { jwttoken } = req.body;

  const decodedToken = jwt.verify(jwttoken, 'secret_key');
    
  // The decodedToken will contain the payload data, including the userId
  const userId = decodedToken.userId;
  
  console.log('User ID:', userId);

  try {
    const bookmarksQuery = 'SELECT bookmarkhouseid FROM bookmarks WHERE bookmarkuserid = $1';
    const { rows: bookmarkIds } = await pool.query(bookmarksQuery, [userId]);

    console.log("(bookmarkIds:", bookmarkIds);

    if (bookmarkIds.length === 0) {
      res.json([]);
    } else {
      const houseIds = bookmarkIds.map((bookmark) => bookmark.bookmarkhouseid);
      console.log("c", houseIds);

      const houses = [];

    for (const houseId of houseIds) {
      console.log("houseId", houseId);
      const housesQuery = 'SELECT * FROM houses WHERE houseid = $1';
      const { rows: house } = await pool.query(housesQuery, [houseId]);
      houses.push(house[0]); // Push the first (and only) row to the 'houses' array
    }
    console.log("housesxxxx", houses);

    const houseimages = [];

    for (const houseId of houseIds) {
      console.log("houseIdhouseId", houseId);
      const housesQuery = 'SELECT * FROM houseimages WHERE houseimagehouseid = $1';
      const { rows: houseimage } = await pool.query(housesQuery, [houseId]);
      houseimages.push(houseimage[0]); // Push the first (and only) row to the 'houses' array
    }
    console.log("houseimagesxxxx", houseimages);
    // Merge houses and houseimages based on houseid
    

    const mergedData = houses.map((house) => {
      console.log("A1 house", house);
      const houseImagesForHouse = houseimages.filter((image) => {
        console.log("A1 image", image);
        console.log("image.houseimagehouseid", image.houseimagehouseid);
        return parseInt(image.houseimagehouseid) === parseInt(house.houseid);
      });
      return {
        ...house,
        images: houseImagesForHouse,
      };
    });

    res.json(mergedData);




    }
    
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
});

app.post('/node/deletebookmark', async(req, res) => {
  const bookmarkid = req.params.bookmarkid;
 
  const { token, houseid} = req.body;
  const decodedToken = jwt.verify(token, 'secret_key');
      
  // The decodedToken will contain the payload data, including the userId
  const userId = decodedToken.userId;
  
  console.log('User ID:', userId);
  console.log('houseidxxxxxxxxxx:', houseid);

  try {
    // Start a transaction to ensure atomicity (either delete all or none)
//    await pool.query('BEGIN');

    // Delete the house from the houses table
    const deleteBookmarkQuery = 'DELETE FROM bookmarks WHERE bookmarkuserid = $1 AND bookmarkhouseid = $2';
    const deleteBookmarkValues = [userId, houseid];
    await pool.query(deleteBookmarkQuery, deleteBookmarkValues);


    // Send a response back to the client
    res.status(200).json({ message: 'Bookmark deleted successfully' });

  } catch (error) {
    // Rollback the transaction in case of any error
    await pool.query('ROLLBACK');
    
    console.error('Error deleting bookmark:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});



app.get('/node/get-image-url', (req, res) => {
  const imageFileName = '1691046396598-731643345-corn-field-g7927da590_1920.jpg'; // Replace with the actual image file name
  const imageURL = `http://localhost:8000/uploads/${imageFileName}`;
  res.json({ image:imageURL });
});




  
  

  
app.listen(8000, () => {
    console.log(`Server is running on port 8000.`);
  });

