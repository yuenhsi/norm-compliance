##

Hi Norm!

I added patch_node, get_node, and debug_trees endpoints to the server.

patch_node modifies a specified node (mutating its reason and status).
get_node retrieves a specific node (used by the client to refresh the tree after a patch).
debug_trees prints out the shape of the database tables, I used it to visualize what's going on.

I added App.tsx, client.ts, and App.scss to the client react app.

App.tsx manages frontend state.
client.ts manages Typing, Routes, and API requests.
.scss file manages styling.

I architected the back-end so the patch request returns a list of affected nodes. This allows
our frontend to support optimistic updates and O(1) node lookups and refreshes. However, since
the size of the tree is currently minimal, instead of managing the extra complexity, the client
simply sequences a get_node(root_id) request after the patch call, refreshing the entire tree, instead of using the patch response to do a partial update.

# Set up

```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

# Running the server

```
source .venv/bin/activate
uvicorn app:app --reload
```

# Running the client

```
cd norm-client
npm install
npm run dev
```
