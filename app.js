const express = require("express");
const app = express();
const fs = require("fs");
var multer = require("multer");
const dirPath = "../docdata";
app.use(express.json());

const apiResponse = (res, status = 200) => (
  data,
  success = true,
  errorMsg = null,
  error = null
) => {
  return res.status(status).json({
    data,
    success,
    errorMsg,
    error,
  });
};

const apiError = (res, status = 500) => (errorMsg = null, error = null) =>
  apiResponse(res, status)(null, false, errorMsg, error);

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,path");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

// 设置静态资源目录
// app.use(express.static("../"));

app.get("/filemanager/list", (req, res) => {
  const path = dirPath + req.query.path || "/";

  fs.readdir(path, (err, files) => {
    if (err) {
      return apiError(res)("Cannot read folder", err);
    }

    let items = (files || []).map((f) => {
      const fpath = path + "/" + f;
      let type = "file";
      let size = 0;
      let createdAt = null;
      let updatedAt = null;
      try {
        const stat = fs.statSync(fpath);
        type = stat.isDirectory() ? "dir" : type;
        size = stat.size;
        createdAt = stat.birthtimeMs;
        updatedAt = stat.mtimeMs;
      } catch (err) {}
      return {
        name: f,
        type,
        size,
        createdAt,
        updatedAt,
      };
    });

    return apiResponse(res)(items);
  });
});

app.post("/filemanager/dir/create", (req, res) => {
  const fullPath = dirPath + req.body.path + "/" + req.body.directory;

  if (fs.existsSync(fullPath)) {
    return apiError(res)("The folder already exist", err);
  }
  try {
    result = fs.mkdirSync(fullPath);
    return apiResponse(res)(result);
  } catch (err) {
    return apiError(res)("Unknown error creating folder", err);
  }
});

app.get("/filemanager/file/content", (req, res) => {
  let path = dirPath + req.query.path;
  return res.download(path);
});

app.post("/filemanager/items/copy", (req, res) => {
  const { path, filenames, destination } = req.body;

  const promises = (filenames || []).map((f) => {
    return new Promise((resolve, reject) => {
      const oldPath = dirPath + path + "/" + f;
      const newPath = dirPath + destination + "/" + f;
      fs.copyFile(oldPath, newPath, (err) => {
        const response = {
          success: !err,
          error: err,
          oldPath,
          newPath,
          filename: f,
        };
        return err ? reject(response) : resolve(response);
      });
    });
  });

  Promise.all(promises)
    .then((values) => {
      return apiResponse(res)(values);
    })
    .catch((err) => {
      return apiError(res)("An error ocurred copying files", err);
    });
});

app.post("/filemanager/items/move", (req, res) => {
  const { path, filenames, destination } = req.body;

  const promises = (filenames || []).map((f) => {
    return new Promise((resolve, reject) => {
      const oldPath = dirPath + path + "/" + f;
      const newPath = dirPath + destination + "/" + f;
      fs.rename(oldPath, newPath, (err) => {
        const response = {
          success: !err,
          error: err,
          oldPath,
          newPath,
          filename: f,
        };
        return err ? reject(response) : resolve(response);
      });
    });
  });

  Promise.all(promises)
    .then((values) => {
      return apiResponse(res)(values);
    })
    .catch((err) => {
      return apiError(res)("An error ocurred moving files", err);
    });
});

app.post("/filemanager/item/move", (req, res) => {
  const { path, destination } = req.body;
  const promise = new Promise((resolve, reject) => {
    fs.rename(dirPath + path, dirPath + destination, (err) => {
      const response = {
        success: !err,
        error: err,
        path,
        destination,
      };
      return err ? reject(response) : resolve(response);
    });
  });

  promise
    .then((values) => {
      return apiResponse(res)(values);
    })
    .catch((err) => {
      return apiError(res)("An error ocurred renaming file", err);
    });
});

app.post("/filemanager/items/upload", (req, res, next) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        // we pass the path by headers because is not present in params at this point
        cb(null, dirPath + req.headers.path);
      },
      filename: (req, file, cb) => {
        cb(null, file.originalname);
      },
    }),
  }).array("file[]");

  upload(req, res, (err) => {
    if (err) {
      return apiError(res)("An error occurred uploading files", err);
    }
    if (!req.files.length) {
      return apiError(res)("Cannot find any file to upload");
    }
    return apiResponse(res)(true);
  });
});

app.post("/filemanager/items/remove", (req, res) => {
  const { path, filenames, selectedFiles, recursive } = req.body;
  console.log(filenames);
  const promises = (selectedFiles || []).map((item) => {
    const fullPath = dirPath + path + "/" + item.name;
    console.log(item, fullPath);
    return new Promise((resolve, reject) => {
      if (item.type === "dir") {
        fs.rmdir(fullPath, { recursive }, (err) => {
          const response = {
            success: !err,
            error: err,
            path,
            filename: item.name,
            fullPath,
          };

          return err ? reject(response) : resolve(response);
        });
      } else {
        fs.unlink(fullPath, (err) => {
          const response = {
            success: !err,
            error: err,
            path,
            filename: item.name,
            fullPath,
          };
          return err ? reject(response) : resolve(response);
        });
      }
    });
  });

  Promise.all(promises)
    .then((values) => {
      return apiResponse(res)(values);
    })
    .catch((err) => {
      console.log(err);
      return apiError(res)("An error ocurred deleting file", err);
    });
});

app.listen(8000, () => {
  console.log("server is listening to port 8000");
});
