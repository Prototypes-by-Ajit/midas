"""
B+ Tree implementation for efficient document chunk indexing.

Features:
- Supports duplicate keys (multiple values per key)
- Range queries for retrieving chunk sequences
- Point lookups for direct chunk access
- Prefix scans for document-level queries
"""

from __future__ import annotations
from typing import Any, Callable, Generic, Iterable, List, Optional, Tuple, TypeVar, Union
import bisect


K = TypeVar("K")
V = TypeVar("V")


class LeafNode(Generic[K, V]):
    """
    Leaf node in B+ tree containing actual key-value pairs.
    Linked to next leaf for efficient range scans.
    """
    __slots__ = ("keys", "values", "next")

    def __init__(self) -> None:
        self.keys: List[K] = []
        self.values: List[List[V]] = []  # Allow duplicate keys -> list of values
        self.next: Optional["LeafNode[K, V]"] = None


class InternalNode(Generic[K, V]):
    """
    Internal node in B+ tree containing separator keys and child pointers.
    """
    __slots__ = ("keys", "children")

    def __init__(self) -> None:
        self.keys: List[K] = []
        self.children: List[Union["InternalNode[K, V]", LeafNode[K, V]]] = []


Node = Union[InternalNode[K, V], LeafNode[K, V]]


class BPlusTree(Generic[K, V]):
    """
    B+ Tree optimized for RAG chunk indexing.
    
    Key features:
    - Insert with duplicate key support
    - Point lookup: O(log n)
    - Range scan: O(log n + m) where m = results
    - All data in leaves, internal nodes only for routing
    
    Args:
        order: Maximum children per internal node (use 32-128 for in-memory)
        key_cmp: Optional custom key comparator
    """

    def __init__(self, order: int = 64, key_cmp: Optional[Callable[[K, K], int]] = None) -> None:
        if order < 4:
            raise ValueError("order must be >= 4 for efficient splits")
        self.order = order
        self.root: Node[K, V] = LeafNode()
        self.key_cmp = key_cmp

    # ----------------
    # Public Interface
    # ----------------

    def insert(self, key: K, value: V) -> None:
        """
        Insert key-value pair. Supports duplicate keys.
        
        Args:
            key: Composite key (e.g., (tenant_id, doc_id, chunk_id))
            value: Value to store (e.g., ChunkMeta)
        """
        split = self._insert(self.root, key, value)
        if split is not None:
            sep_key, right_node = split
            new_root: InternalNode[K, V] = InternalNode()
            new_root.keys = [sep_key]
            new_root.children = [self.root, right_node]
            self.root = new_root

    def get(self, key: K) -> List[V]:
        """
        Point lookup for exact key match.
        
        Args:
            key: Key to lookup
            
        Returns:
            List of all values with this key (empty if not found)
        """
        leaf = self._find_leaf(self.root, key)
        i = bisect.bisect_left(leaf.keys, key)
        if i < len(leaf.keys) and leaf.keys[i] == key:
            return list(leaf.values[i])
        return []

    def range_query(self, low: K, high: K) -> List[V]:
        """
        Inclusive range query: low <= key <= high.
        
        Useful for:
        - Fetching all chunks in a document
        - Retrieving chunk sequences
        - Window-based context expansion
        
        Args:
            low: Start key (inclusive)
            high: End key (inclusive)
            
        Returns:
            All values in range
        """
        results: List[V] = []
        leaf = self._find_leaf(self.root, low)

        while leaf is not None:
            for k, vs in zip(leaf.keys, leaf.values):
                if k < low:
                    continue
                if k > high:
                    return results
                results.extend(vs)
            leaf = leaf.next
        return results

    def iter_range(self, low: K, high: K) -> Iterable[Tuple[K, V]]:
        """
        Streaming inclusive range iteration (memory efficient).
        
        Args:
            low: Start key (inclusive)
            high: End key (inclusive)
            
        Yields:
            (key, value) tuples in range
        """
        leaf = self._find_leaf(self.root, low)
        while leaf is not None:
            for k, vs in zip(leaf.keys, leaf.values):
                if k < low:
                    continue
                if k > high:
                    return
                for v in vs:
                    yield (k, v)
            leaf = leaf.next

    def count_range(self, low: K, high: K) -> int:
        """
        Count values in range without retrieving them.
        
        Args:
            low: Start key (inclusive)
            high: End key (inclusive)
            
        Returns:
            Number of values in range
        """
        count = 0
        leaf = self._find_leaf(self.root, low)
        while leaf is not None:
            for k, vs in zip(leaf.keys, leaf.values):
                if k < low:
                    continue
                if k > high:
                    return count
                count += len(vs)
            leaf = leaf.next
        return count

    # ----------------
    # Internal Methods
    # ----------------

    def _find_leaf(self, node: Node[K, V], key: K) -> LeafNode[K, V]:
        """Navigate to leaf node that should contain key."""
        while isinstance(node, InternalNode):
            idx = bisect.bisect_right(node.keys, key)
            node = node.children[idx]
        return node

    def _insert(self, node: Node[K, V], key: K, value: V) -> Optional[Tuple[K, Node[K, V]]]:
        """Recursive insert, returns (separator_key, new_node) if split."""
        if isinstance(node, LeafNode):
            return self._insert_into_leaf(node, key, value)
        else:
            return self._insert_into_internal(node, key, value)

    def _insert_into_leaf(self, leaf: LeafNode[K, V], key: K, value: V) -> Optional[Tuple[K, Node[K, V]]]:
        """Insert into leaf, split if necessary."""
        i = bisect.bisect_left(leaf.keys, key)
        if i < len(leaf.keys) and leaf.keys[i] == key:
            # Duplicate key - append to existing values
            leaf.values[i].append(value)
        else:
            # New key - insert
            leaf.keys.insert(i, key)
            leaf.values.insert(i, [value])

        # Split if overflow
        if len(leaf.keys) >= self.order:
            return self._split_leaf(leaf)
        return None

    def _split_leaf(self, leaf: LeafNode[K, V]) -> Tuple[K, Node[K, V]]:
        """Split leaf node into two, return (separator_key, right_node)."""
        mid = len(leaf.keys) // 2
        right = LeafNode[K, V]()
        right.keys = leaf.keys[mid:]
        right.values = leaf.values[mid:]
        leaf.keys = leaf.keys[:mid]
        leaf.values = leaf.values[:mid]

        # Link leaves for range scans
        right.next = leaf.next
        leaf.next = right

        # Separator is first key in right leaf
        sep_key = right.keys[0]
        return (sep_key, right)

    def _insert_into_internal(self, internal: InternalNode[K, V], key: K, value: V) -> Optional[Tuple[K, Node[K, V]]]:
        """Insert into internal node, propagate splits."""
        idx = bisect.bisect_right(internal.keys, key)
        child = internal.children[idx]
        split = self._insert(child, key, value)
        if split is None:
            return None

        sep_key, right_node = split
        # Insert separator key + new child pointer
        insert_pos = bisect.bisect_right(internal.keys, sep_key)
        internal.keys.insert(insert_pos, sep_key)
        internal.children.insert(insert_pos + 1, right_node)

        if len(internal.children) > self.order:
            return self._split_internal(internal)
        return None

    def _split_internal(self, internal: InternalNode[K, V]) -> Tuple[K, Node[K, V]]:
        """Split internal node, return (separator_key, right_node)."""
        mid_child = len(internal.children) // 2
        mid_key_index = mid_child - 1

        sep_key = internal.keys[mid_key_index]

        right = InternalNode[K, V]()
        right.children = internal.children[mid_child:]
        right.keys = internal.keys[mid_key_index + 1:]

        internal.children = internal.children[:mid_child]
        internal.keys = internal.keys[:mid_key_index]

        return (sep_key, right)
