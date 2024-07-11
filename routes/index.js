var express = require("express");
var router = express.Router();
const userModel = require("./users");
const postModel = require("./posts");
const localStrategy = require("passport-local");
const upload = require("./multer");

const passport = require("passport");
passport.use(new localStrategy(userModel.authenticate()));

router.get("/", function (req, res) {
  res.render("index", { footer: false });
});

router.get("/login", function (req, res, next) {
  res.render("login", { footer: false, error: req.flash("error") });
});

router.get("/feed", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  const posts = await postModel.find().populate("user");
  res.render("feed", { footer: true, posts, user });
});

router.get("/profile", isLoggedIn, async function (req, res) {
  const user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate("posts");
  res.render("profile", { footer: true, user });
});

// view profile of other user code from gpt

router.get("/profile/:username", isLoggedIn, async function (req, res) {
  try {
    const otherUser = await userModel
      .findOne({ username: req.params.username })
      .populate("posts");
    if (!otherUser) {
      // Handle case where user with provided username is not found
      return res.status(404).send("User not found");
    }
    res.render("profile", { footer: true, user: otherUser });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});



router.get("/search", isLoggedIn, function (req, res) {
  res.render("search", { footer: true });
});

router.get("/follow/post/:id", isLoggedIn, async function (req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    const post = await postModel.findOne({ _id: req.params.id });
    
    if (post.followers.includes(user._id)) {
      return res.status(400).json({ error: "User is already following this post." });
    }

    // Add the user to the post's followers
    post.followers.push(user._id);
    await post.save();

    res.status(200).json({ message: "Successfully followed the post." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/like/post/:id", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  const post = await postModel.findOne({ _id: req.params.id });

  // if like remove like
  // or ifn't like then add like

  if (post.likes.indexOf(user._id) === -1) {
    post.likes.push(user._id);
  } else {
    post.likes.splice(post.likes.indexOf(user._id), 1);
  }
  await post.save();
  res.redirect("/feed");
});

router.get("/username/:username", isLoggedIn, async function (req, res) {
  const regex = new RegExp(`^${req.params.username}`, "i");
  const users = await userModel.find({ username: regex });
  res.json(users);
});

router.get("/edit", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render("edit", { footer: true, user });
});

router.get("/upload", isLoggedIn, function (req, res) {
  res.render("upload", { footer: true });
});

// Profile Update code ..
router.post(
  "/update",
  isLoggedIn,
  upload.single("image"),
  async function (req, res, next) {
    const user = await userModel.findOneAndUpdate(
      { username: req.session.passport.user },
      { username: req.body.username, name: req.body.name, bio: req.body.bio },
      { new: true }
    );
    if (req.file) {
      user.profileImage = req.file.filename;
    }
    await user.save();
    res.redirect("/profile");
  }
);

router.post("/register", function (req, res) {
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    email: req.body.email,
  });

  userModel.register(userData, req.body.password).then(function () {
    passport.authenticate("local")(req, res, function () {
      res.redirect("/feed");
    });
  });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/feed",
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (req, res) {}
);

router.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

router.post(
  "/upload",
  isLoggedIn,
  upload.single("image"),
  async function (req, res, next) {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });
    const post = await postModel.create({
      picture: req.file.filename,
      user: user._id,
      caption: req.body.caption,
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect("/feed");
  }
);

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

module.exports = router;
