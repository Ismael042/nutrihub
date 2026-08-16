import re

_DIGITS_RE = re.compile(r"\D")


def only_digits(value: str) -> str:
    return _DIGITS_RE.sub("", value)


def _check_digit(digits: str, weights: range) -> int:
    total = sum(int(d) * w for d, w in zip(digits, weights))
    remainder = total % 11
    return 0 if remainder < 2 else 11 - remainder


def is_valid_cpf(digits: str) -> bool:
    if len(digits) != 11 or not digits.isdigit():
        return False
    if digits == digits[0] * 11:
        return False
    if _check_digit(digits[:9], range(10, 1, -1)) != int(digits[9]):
        return False
    if _check_digit(digits[:10], range(11, 1, -1)) != int(digits[10]):
        return False
    return True
