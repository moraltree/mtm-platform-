"""Apply exact (old, new) replacements from a Python list file to a story; each old must occur once."""
import sys, ast
story, edits = sys.argv[1], ast.literal_eval(open(sys.argv[2]).read())
t = open(story).read()
bad = [a[:60] for a, _ in edits if t.count(a) != 1]
if bad: sys.exit("Not found exactly once: " + " | ".join(bad))
for a, b in edits: t = t.replace(a, b)
open(story, 'w').write(t); print(f"applied {len(edits)} edits")
