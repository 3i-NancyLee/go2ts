# go2ts

1. Run command

```
$ node convert.js schemas
```

2. Check output files under /out_schemas

3. Put the cursor on the first "mongoose.Schema.Types.String" string and press `ds"` to delete the surrounding quotes.

4. Then, put the cursor to the next "mongoose.Schema.Types.String" string and press `.` to repeat the last command.

5. Remove redundant schema definitions, including
   - Permission
   - Role
   - Token
   - User
