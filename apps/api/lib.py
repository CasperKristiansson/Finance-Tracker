from datetime import datetime
from typing import List, Union, Literal
from pydantic import BaseModel, PositiveFloat


class BaseTransaction(BaseModel):
    note: str
    amount: PositiveFloat
    dateTime: datetime


class DebitCreditTransaction(BaseTransaction):
    type: Literal["debit", "credit"]
    tag: List[str]
    account: str
    category: str


class TransferTransaction(BaseTransaction):
    type: Literal["transfer"]
    fromAccount: str
    toAccount: str


Transaction = Union[DebitCreditTransaction, TransferTransaction]
