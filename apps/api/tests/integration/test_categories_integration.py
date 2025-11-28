from __future__ import annotations

from uuid import UUID, uuid4


def test_create_and_list_categories(api_call, json_body) -> None:
    name = f"Integration Cat {uuid4().hex[:6]}"
    create_payload = {
        "name": name,
        "category_type": "expense",
        "color_hex": "#123456",
        "icon": "wallet",
    }
    create_resp = api_call("POST", "/categories", create_payload)
    assert create_resp["statusCode"] == 201
    created = json_body(create_resp)
    created_id = UUID(created["id"])

    list_resp = api_call("GET", "/categories")
    assert list_resp["statusCode"] == 200
    categories = json_body(list_resp)["categories"]
    assert any(UUID(cat["id"]) == created_id and cat["name"] == name for cat in categories)


def test_update_category_fields(api_call, json_body) -> None:
    name = f"Update Cat {uuid4().hex[:6]}"
    create_resp = api_call(
        "POST",
        "/categories",
        {"name": name, "category_type": "income", "color_hex": "#abcdef"},
    )
    category_id = json_body(create_resp)["id"]

    patch_payload = {"name": f"{name}-updated", "is_archived": True, "color_hex": "#654321"}
    patch_resp = api_call("PATCH", f"/categories/{category_id}", patch_payload)
    assert patch_resp["statusCode"] == 200
    patched = json_body(patch_resp)
    assert patched["name"] == patch_payload["name"]
    assert patched["is_archived"] is True
    assert patched["color_hex"] == "#654321"

    list_resp = api_call("GET", "/categories?include_archived=true")
    archived = {UUID(cat["id"]): cat for cat in json_body(list_resp)["categories"]}
    assert UUID(category_id) in archived
    assert archived[UUID(category_id)]["is_archived"] is True


def test_merge_categories(api_call, json_body) -> None:
    src_name = f"Src Cat {uuid4().hex[:6]}"
    tgt_name = f"Tgt Cat {uuid4().hex[:6]}"

    src_resp = api_call(
        "POST",
        "/categories",
        {"name": src_name, "category_type": "expense"},
    )
    tgt_resp = api_call(
        "POST",
        "/categories",
        {"name": tgt_name, "category_type": "expense"},
    )
    src_id = json_body(src_resp)["id"]
    tgt_id = json_body(tgt_resp)["id"]

    merge_payload = {
        "source_category_id": src_id,
        "target_category_id": tgt_id,
        "rename_target_to": f"Merged {uuid4().hex[:4]}",
    }
    merge_resp = api_call("POST", "/categories/merge", merge_payload)
    assert merge_resp["statusCode"] == 200
    merged = json_body(merge_resp)
    assert merged["id"] == tgt_id
    assert merged["name"] == merge_payload["rename_target_to"]

    list_resp = api_call("GET", "/categories?include_archived=true")
    cats = {UUID(cat["id"]): cat for cat in json_body(list_resp)["categories"]}
    assert UUID(tgt_id) in cats and cats[UUID(tgt_id)]["name"] == merge_payload["rename_target_to"]
    assert UUID(src_id) in cats and cats[UUID(src_id)]["is_archived"] is True
