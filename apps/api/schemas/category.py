"""Pydantic schemas for category API endpoints."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared import CategoryType


class CategoryCreate(BaseModel):
    """Request payload for creating a category."""

    name: str = Field(min_length=1, max_length=120)
    category_type: CategoryType
    color_hex: Optional[str] = Field(default=None, min_length=4, max_length=7)


class CategoryUpdate(BaseModel):
    """Payload for partial updates to a category."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    category_type: Optional[CategoryType] = None
    color_hex: Optional[str] = Field(default=None, min_length=4, max_length=7)
    is_archived: Optional[bool] = None

    @model_validator(mode="after")
    def ensure_updates_present(self) -> "CategoryUpdate":
        if not any(
            value is not None
            for value in (self.name, self.category_type, self.color_hex, self.is_archived)
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class CategoryRead(BaseModel):
    """Response model representing a category."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    category_type: CategoryType
    color_hex: Optional[str] = None
    is_archived: bool


class ListCategoriesQuery(BaseModel):
    """Query parameters for listing categories."""

    include_archived: bool = Field(default=False, alias="include_archived")


class CategoryPathParams(BaseModel):
    """Path parameters for category handlers."""

    category_id: UUID


class CategoryListResponse(BaseModel):
    """Response body for category listing."""

    categories: list[CategoryRead]


__all__ = [
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryRead",
    "ListCategoriesQuery",
    "CategoryPathParams",
    "CategoryListResponse",
]
